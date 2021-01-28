---
slug: hbase-filter-mapreduce
date: 2021-01-28
title: 'HBase (filter)MapReduce'
description: 'Explore advanced uses of HBase filters and endpoint coprocessors by building a toy data processing framework.'
tags: ['HBase']
keywords: ['hbase', 'filters', 'coprocessors']
published: true
author: Pavol Vidlička
---

HBase is both an awe-inspiring and an intimidating technology. I have a love-hate
relationship with it. I like the extensibility and flexibility,
but its data model is complex, and using its extension mechanisms comes at a cost.
Not to mention operational pitfalls. However, when you need to access
a huge amount of data in (soft) real-time (and are familiar with Hadoop),
it could be the tool for you. Especially if you want store partially aggregated data
and need to do some further processing on request,
as is often the case with analytical use cases.

To give you a concrete example of how to go on about implementing such a system
on top of HBase, I have built a bare-bones and very-much-not-production-ready
data processing framework that uses HBase filters and coprocessors.
The source code, together with a few tests that illustrate how to use the framework
are [published on Github](https://github.com/pvid/filter-mapreduce).

# HBase architecture crash course

Take a deep breath there is a lot to cover.

[HBase](https://hbase.apache.org/)
is a distributed NoSQL database built on top of Hadoop.
The basic block of the HBase data model is a *cell*, which is an addressable blob
of binary data. HBase tables are comprised of *rows* that are identified by
a binary *rowkey*. Each rows can have a variable number of columns
that hold individual cells. A column is identified by its *column family*
and *column qualifier*. Column families need to be defined upfront.
Column families are stored in separate files, which allows for efficient pruning
when selecting just a subset of them.
Column qualifiers is an arbitrary binary identifier. You can define them on the fly
and each row can have a different set of qualifiers.

When iterating over columns in a row, the columns are sorted lexicographically,
first by column family and then by qualifier.

```table
          |     column family 1      | column family 2 |
          | ------------------------ | --------------- |
          | qual1  | qual2  | qual3  | qual1  | qual4  |
| ------- | ------ | ------ | ------ | ------ | ------ |
| rowkey1 |  cell  |   -    |  cell  |  cell  |  cell  |
| rowkey2 |   -    |  cell  |  cell  |   -    |  cell  |
```

The fact that rowkeys, column qualifiers, and cell data can be arbitrary
bytes gives a lot of flexibility when it comes to schema design
and data formats used.

Rows in each table are lexicographically sorted by rowkey and
split into rowkey ranges. Each such range
is called a *region*. The regions are distributed onto multiple
*region servers*. Each of the region servers usually holds several
regions, and it is not unusual that one region server hosts multiple
regions of a particular table.

Still with me? Great! There is actually a lot of important details I glossed over
(cell versioning, how the data is stored within a region, MVCC, ...),
but this should encompass everything needed to understand the rest of this article.

# Reading data from HBase

Getting data from HBase is relatively cumbersome. There is no native query language.
The basic way how to access the data is to perform a [`Scan`](https://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/client/Scan.html).

There is a lot of attributes that you can use to restrict the Scan
to a subset of your data. it usually goes like this:

1. You specify a range of keys
1. then select a set of column families and/or column qualifier
1. initialize the scan and receive results row by row

You get a [`ResultScanner`](https://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/client/ResultScanner.html),
which implements `Iterable<Result>`, where [Result](http://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/client/Result.html)
contains all the cells from specified columns from a single row. In code:

```java
Table table = ... // some HBase table
Scan scan = new Scan();
scan.setStartRow(startRow);
scan.setStopRow(stopRow);
scan.addFamily(columnFamily);
scan.addColumn(columnFamily, qualifier);

ResultScanner scanner = table.getScanner(scan);
Iterator<Result> results = scanner.iterator();
```

Notice that the API is pretty close to the data model, and it is not very expressive.
For example, what if you only wanted rows whose rowkey starts with a byte
that is an even number?

Well, you have do have an iterator, you can go ahead, iterate over all rows
and just throw away the ones with rowkeys you don't want.
However, this approach is wasteful - it results in a lot of unnecessary network IO,
which comes with increased latency.

What you might want is to push the filtering to HBase region servers.
That would reduce the amount of data sent to the client.
Filter pushdown is a Big Data evergreen that can significantly
reduce latency.

Thankfully, doing advanced filtering is possible by setting
an HBase `Filter` using the [Scan#setFilter](http://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/client/Scan.html#setFilter-org.apache.hadoop.hbase.filter.Filter-)
method.
The [`Filter`](http://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/filter/Filter.html)
interface contains multiple methods that can influence which Results
will be returned to the client.
For example, the following `Filter` returns only rows with rowkeys starting with
an even byte:

```java
public class EvenFirstRowkeyByteFilter extends FilterBase {

  @Override
  public boolean filterRowKey(Cell cell) {
    byte firstByte = cell.getRowArray()[cell.getRowOffset()];
    // return true to filter out row
    return firstByte % 2 != 0;
  }

  @Override
  public byte[] toByteArray() throws IOException {
    return new byte[0];
  }

  public static Filter parseFrom(byte[] bytes) throws DeserializationException {
    return new EvenFirstRowkeyByteFilter();
  }
}
```

There is a lot going on, considering how simple the filtering logic is.
Remember that our filter needs to be serialized, sent off together
with the `Scan` specification to region servers, and then deserialized.
That is what the methods `toByteArray` and `parseFrom` are for - HBase
needs to know how to serialize and deserialize the parameters of our filter.
The implementation for `EvenFirstRowkeyByteFilter` is trivial since
it does not have any parameters

Before implementing a filter, check if HBase does not have you covered
with already [included filters](http://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/filter/package-summary.html).

Knowing how to implement a custom `Filter` is nice and all, but it is sooo much work!
Us, developers, we are spoiled rotten by our [shiny](https://youtu.be/93lrosBEW-Q?t=27)
Java streams, Scala collections, and even Spark, where we can simply write something
like `filter(rowkey -> rowkey[0] % 2 == 0)` and go get a cup of coffee.

Enter...

# (filter)MapReduce!

It is a framework that provides a `Dataset` class. It wraps a scan
and provides a higher-level API, which supports various
filter and map operations, which get translated into lower-level
filters that are pushed to region servers.

Given an HBase `table` and a `scan` object, the following code
creates a `ResultScanner` with only rows, whose rowkeys start with even bytes.

```java
ResultScanner scanner =
  dataset
    .filterByRowkey(rowkey -> rowkey[0] % 2 == 0)
    .toScanner();
```

Check the javadoc of the `Dataset` class for all implemented methods.
You can:

- filter whole rows based on rowkey with a `byte[] -> boolean` function
- filter individual cells (using `filterCells` method) with a `Cell -> boolean` function
- `mapRows` using a `List<Cell> -> List<Cell>` function
- `mapCells` with a `Cell -> Cell` function
- `mapCellValues` with a `byte[] -> byte[]` function

If you'd like to get your hands dirty and better understand how it all
works, try to implement a `filterByCellValue` method
(accepting a `List<Cell> -> boolean` function), that can be translated
into a `filterCells` call. And if you like you like to jump at the deep end,
try to do implement a `filterRows` method that takes a `List<Cell> -> boolean` function
(you will need to implement an underlying HBase filter, more on that later).

## Shakespeare test suite

To showcase the `Dataset` API and provide a playground to try it out,
I have created a test suite that uses an HBase mini-cluster,
which has a table populated with the complete works of Shakespeare.

Each row contains just one cell, which holds a serialized JSON record
that represents a single line of text.

```json
{
  "play": "Hamlet",
  "lineCoordinates": "3.1.64",
  "speaker": "HAMLET",
  "text": "To be, or not to be: that is the question:"
}
```

The rowkey is composed of 4 concatenated
integer `{play ID}{act}{scene}{line number}`. The hierarchical rowkey design
allows scanning a single play, act, or scene by simply setting the appropriate
start and stop rowkeys.

We have a data processing framework and a corpus of text. Do you know what's coming?
You guessed right! A word count example!

## Shakespearean word count

Our simple word count is going to:

1. Extract the `text` field from the record
1. Tokenize the text into a `Map<String, Integer>` holding the counts of words
1. Reduce the individual word counts together into a one final `Map<String, Integer>`

We could push the first 2 steps to region servers using two calls to `mapCellValues`
and do the 3rd step on the client.
However, that would result in a lot of redundant data sent over the wire
and it could overwhelm the client (what if the corpus was the whole of [Project Gutenberg](https://www.gutenberg.org/)?)
Could we push the reduce step (at least partially) to region servers?

I am sure you can guess the answer - if we could not, the framework would be
called just (filter)Map.

The `Dataset` class has two methods that we can use - `reduceCells` and `reduceCellValues`.
The reduce operation (let's take `reduceCells` for concreteness) has two stages.

The first stage is executed on region servers (in parallel). It takes an initial
accumulator value of type `A` and a function `(A, Cell) -> A`
that reduces all the data requested from a given region server into one value
of type `A`.

The second stage is executed on the client. It accepts an initial accumulator value
of type `B` and a function `(B, A) -> B` that merges the partial results
from all the region servers into one final value.

A `reduceRows` method that would take a
`(A, List<Cell>) -> A` function as a reducer could also be implemented.

Using our newfound reducing powers, we can do a true distributed word count!
I omit the implementation of helper functions to make it at least a bit easier
on the eyes. Also, think of `WordCount` as a type alias of `Map<String, Interger>`.
(I know, Java 8 does not really have those, but bear with me).

```java
Dataset Shakespeare = new Dataset(ShakespeareTable);

SerializableFunction<byte[], byte[]> extractText = ...;
SerializableFunction<byte[], byte[]> tokenize = ...;
SerializableBiFunction<WordCount, byte[], WordCount> reducer = ...;
SerializableBiFunction<WordCount, WordCount, WordCount> merger = ...;

Map<String, Integer> result =
  Shakespeare
    .mapCellValues(extractText)
    .mapCellValues(tokenize)
    .reduceCellValues(
      emptyWordCount(), reducer,
      emptyWordCount(), merger
    );
```

Take a look at [ShakespeareDatasetSuiteElement](https://github.com/pvid/filter-mapreduce/blob/master/src/test/java/dev/vidlicka/hbase/filtermapreduce/dataset/ShakespeareDatasetSuiteElement.java)
for more (runnable) examples.

The test suite spits out a very, very naive text analysis report when run:

```text
Number of lines in Shakespearean plays: 104992
Number of speakers in Shakespearean plays: 935
Most lines (1808 in fact) were spoken by GLOUCESTER
Number of distinct words in Shakespearean plays: 25014
Total number of words in Shakespearean plays: 1003549
The most frequent word (25988 occurrences) is 'the'
```

# Under the hood

Let's dive into how (filter)MapReduce is implemented.
I'll start the skeleton in the closet.

## Function serialization

The lambda functions given to various map and filter function need to be serializable,
because they are supposed to be sent over the wire to HBase region servers.

The type signatures do get a little hairy. I tried to make the code a bit more readable
using helper types.

```java
@FunctionalInterface
public interface SerializableFunction<T, R> extends Serializable, Function<T, R> {}

@FunctionalInterface
public interface SerializablePredicate<T> extends Serializable, Predicate<T> {}
```

The serialization itself is the most ill-advised part of the whole implementation.
It uses vanilla Java serialization facilities without any regard to safety
or binary compatibility on different JVMs. You have been warned.

## Filtering

Filter operations are the most straightforward - it is what the `Filter` interface was
primarily intended to do. Let's look at `RowkeyPredicateFilter` which is a generalization
of the `EvenFirstRowkeyByteFilter` example:

```java
public class RowkeyPredicateFilter extends FilterBase {

  SerializablePredicate<byte[]> predicate;

  public RowkeyPredicateFilter(SerializablePredicate<byte[]> predicate) {
    this.predicate = predicate;
  }

  @Override
  public boolean filterRowKey(Cell cell) {
    // we want to filter row out, when predicate returns false
    return !predicate.test(Arrays.copyOfRange(cell.getRowArray(), cell.getRowOffset(),
        cell.getRowOffset() + cell.getRowLength()));
  }

  @Override
  public byte[] toByteArray() throws IOException {
    return SerdeUtil.serialize(predicate);
  }

  public static Filter parseFrom(byte[] bytes) throws DeserializationException {
    try {
      return new RowkeyPredicateFilter(SerdeUtil.deserialize(bytes));
    } catch (IOException | ClassNotFoundException e) {
      throw new DeserializationException(e);
    }
  }
}
```

The other predicate-based filter, `CellPredicateFilter`, is implemented using
the `filterCell` method, which allows to filter individual cells. The implementation
is very similar.

Note: I will leave the `toByteArray` and `parseFrom` methods from following `Filter`
examples.

## Mapping with Filters

HBase filters can be used to transform rows and cells
as well.

Cell transformation is supported by the [`Filter#transformCell`](http://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/filter/Filter.html#transformCell-org.apache.hadoop.hbase.Cell-)
method, which is a straightforward `Cell -> Cell` transformation.
An example of a built-in filter using it is the [`KeyOnlyFilter`](http://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/filter/KeyOnlyFilter.html),
which discards the cells contents. It reduces network IO in cases where the value
do not matter.

Transformation of whole rows is a bit more hacky - it uses the [`filterRowCells`](http://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/filter/Filter.html#filterRowCells-java.util.List-)
method, which gives you the "chance to alter the list of Cells to be submitted".
It takes a `List<Cell>` representing the whole row. The method itself
does not have a return value, but nobody
said anything about tampering with the list itself.

```java
public class RowMapperFilter extends FilterBase {

  SerializableFunction<List<Cell>, List<Cell>> func;

  public RowMapperFilter(SerializableFunction<List<Cell>, List<Cell>> func) {
    this.func = func;
  }

  @Override
  public void filterRowCells(List<Cell> ignored) throws IOException {
    List<Cell> newRowCells = func.apply(new ArrayList<>(ignored));
    ignored.clear();
    ignored.addAll(newRowCells);
  }

  // Has to return true to comply with the `Filter` contract, see
  // http://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/filter/Filter.html#hasFilterRow--
  public boolean hasFilterRow() {
    return true;
  }
}
```

## Filter composition

The usability of filters would be quite limited if there was not a way
to compose them. HBase provides a [`FilterList`](http://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/filter/FilterList.html)
class. It has two modes - `MUST_PASS_ALL` and `MUST_PASS_ONE`,
which roughly correspond to logical `AND` and `OR`. You can use multiple nested
`FilterLists` to build a whole tree of filters to represent very complex
logic.

In my experience, using a single `FilterList` with `MUST_PASS_ALL` is relatively
intuitive. However, when you have multiple nested `FiltersLists`, some of which
are `MUST_PASS_ONE`, things can get rather headache-y fast. Especially when you
sprinkle in a few filters that transform the cells or whole rows.
You have to really understand the order of calls to `Filter` methods during scanning.
I would advise staying away even if you feel like an HBase Gandalf 🧙.

## Pushing reduce server-side

HBase filters allow you to hook into native scanning operation
to run your own logic. However, you are still limited
to a basic blueprint of a scan: read -> filter/transform -> return to the client.

Endpoint coprocessors allow you to implement your own communication protocol
with region servers. They run directly on region servers - one instance
per region.

An endpoint coprocessor `Hello World` would be an endpoint that counts rows.
It would return the number of rows in a region when called.
Sending requests to coprocessors is done using the HBase client library.
The client is then responsible to handle responses from individual regions.
In this example, it could process partial counts from all the region
into a grand total of all the rows from all the regions.

Such a row count endpoint would be a specific example of a more general type of aggregating
endpoint coprocessor, which computes a partial aggregate for each region and sends
it off to the client. The benefits of such an aggregating endpoint are to reduce
network IO and also parallelize the computation across all the regions.

The server-side reduce functionality of (filter)MapReduce is implemented
exactly as such a general aggregating coprocessor. Let's look at it
in more detail. It has a server-side stage that does partial reduction
and a client-side stage which merges the partial reduce results together.

We will need three ingredients for the server-side part - an initial value, reduce function, and a scan
that specifies the data that should be read.

HBase coprocessor RPC protocols are defined defined as [protocol buffer services](https://developers.google.com/protocol-buffers/docs/proto#services).
This is the definition of our `ReducerService`

```proto
option java_package = "dev.vidlicka.hbase.filtermapreduce.reducer";
option java_outer_classname = "ProtoService";
option optimize_for = SPEED;
option java_generic_services = true;


service ReducerService {
    rpc reduce(ReducerRequest) returns (ReducerResponse);
}

message ReducerRequest {
    required bytes initial_value = 1;
    required bytes reducer = 2;
    optional bytes serializedScan = 3;
}

message ReducerResponse {
    required bytes result = 1;
}
```

As you can see, the `ReducerRequest` contains all three aforementioned
things in serialized form and the response is just a single serialized value.
The service definition needs to be compiled using `protoc`. The result is
an abstract class which we will extend to provide the actual implementation.
The `RegionCoprocessor` interface also needs to be implemented so that HBase
knows how to initialize and teardown our custom endpoint.

```java
public class ReducerEndpoint extends ReducerService implements RegionCoprocessor {
  private RegionCoprocessorEnvironment env;

  @Override
  public void reduce(RpcController controller, ReducerRequest request,
      RpcCallback<ReducerResponse> done) {
    // actual implementation
  }

  @Override
  public Iterable<Service> getServices() {
    return Collections.singleton(this);
  }

  @Override
  public void start(CoprocessorEnvironment env) throws IOException {
    // necessary setup
    if (env instanceof RegionCoprocessorEnvironment) {
      this.env = (RegionCoprocessorEnvironment) env;
    } else {
      throw new CoprocessorException("Must be loaded on a table region!");
    }
  }

  @Override
  public void stop(CoprocessorEnvironment env) throws IOException {
    // release any resources acquire
  }
}
```

To call the coprocessor from the client, use the [`Table#coprocessorService`](http://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/client/Table.html#coprocessorService-byte:A-)
or [`Table#batchCoprocessorService`](http://hbase.apache.org/2.2/devapidocs/org/apache/hadoop/hbase/client/Table.html#batchCoprocessorService-com.google.protobuf.Descriptors.MethodDescriptor-com.google.protobuf.Message-byte:A-byte:A-R-)
method. A common practice is to wrap the raw HBase API with a client class
to improve usability (see the [`ReducerClient`](https://github.com/pvid/filter-mapreduce/blob/master/src/main/java/dev/vidlicka/hbase/filtermapreduce/reducer/ReducerClient.java)
class as an example).

I'm not going to lie, implementing a custom HBase endpoint coprocessor
is hard. To do anything interesting, you need to have a pretty
good understanding of how HBase regions work and have to deal
with a few APIs that are not that pleasant to work with.
Even better, if you mess up, you can compromise the stability
of your cluster. Either by running resource intensive code and thus
burdening servers or even crashing them with an unhandled exception.

## Tying it all together

Now that we have all our filters and also a `ReducerService` with a client implementation,
we can wrap it in a higher-level API. The [`Dataset`](https://github.com/pvid/filter-mapreduce/blob/master/src/main/java/dev/vidlicka/hbase/filtermapreduce/dataset/Dataset.java)
class handles filter initialization, their composition, and delegates `reduce` calls
to the `ReducerClient`.

It could do more. For example, it could implement something akin to Apache Spark's
[Encoder](https://spark.apache.org/docs/2.4.5/api/java/org/apache/spark/sql/Encoder.html)
framework that would automatically convert cell value to/from `byte[]`.
That would allow the `mapCellValues` method for example to take a generic `A -> B`
lambda function for types that have encoders instead of `byte[] -> byte[]`.

But that is again just wrapping lower-level code with a more convenient API.
The filters and coprocessor underneath is the real meat and potatoes
of (filter)MapReduce.

## Note on schema design

As you can guess, this framework is only useful for tables designed in such a way
that all the cells (or all the cells in a column family or all
the cells in certain columns) hold data encoded in the same format.

It does not do justice to the flexibility that HBase provides.
Each column could just as well hold a different binary format - bson,
protocol buffers - and throw in some Avro for good measure!

A uniform table design used here is not that unusual.
For example, Apache Phoenix - a SQL engine built on top of HBase
packs all the columns in a row into a single cell instead of mapping SQL schema
columns to HBase columns. They did use the latter approach but switched
to the former as a storage size and performance optimization.
If interested, see [Phoenix documentation](https://phoenix.apache.org/columnencoding.html)
for details.

# HBase as a platform

You can use a combination of filters and endpoint coprocessors for data processing
and observer coprocessors (more on them maybe in a future post) to implement a distributed
system backed by a CP store.

Many open-source projects do just that. To mention a few:

- Apache Phoenix - distributed OLTP database
- Apache Kylin - OLAP database
- OpenTSDB - time-series database
- Titan - graph database with HBase as one of its storage backends

I also recommend the blog of [Robert Yokota](https://yokota.blog/).
His hobby seems to be building databases on top of other databases.
His HBase work includes [HGraphDB](https://yokota.blog/2016/11/10/hgraphdb-hbase-as-a-tinkerpop-graph-database/) (graph database)
and [HDocDB](https://yokota.blog/2016/03/17/hbase-as-a-multi-model-data-store/) (document database).
He also likes to do similar things for Apache Kafka - he has built a Kafka-backed [KV store](https://yokota.blog/2018/11/19/kcache-an-in-memory-cache-backed-by-kafka/)
and on top of it [an SQL layer](https://yokota.blog/2019/09/23/building-a-relational-database-using-kafka/),
graph database, document database and even an [etcd compatible metastore](https://yokota.blog/2020/11/09/keta-a-metadata-store-backed-by-apache-kafka/).

# Wrapping up

Hopefully, this is needless to say, but do not use (filter)MapReduce or any of its parts
in production. The API is janky - you are forced to work with raw bytes,
and everything is littered with serialization and deserialization code.
It is also a huge security risk. I did not put any thought into the lambda serialization
implementation - it is literally the first version that kind of worked.

Moreover, the whole idea of a framework like this is to remotely execute arbitrary code
on a database cluster holding your precious data - do you really want to do that?

However, you could take the concepts presented here and basically "inline"
all the lambda functions to implement your own specialized filters and coprocessors
that solve your specific problems and are optimized for your data.

I believe that stretching ideas to their limits is a great way to explore them.
It can inspire you to build great things and (hopefully) to stay away
from the most outlandish ideas when building something that serves your customers.
