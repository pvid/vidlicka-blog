---
slug: hbase-filter-mapreduce
date: 2019-11-24
title: 'HBase (filter)MapReduce'
description: 'Explore advanced uses of HBase filters and endpoint coprocessors by building a toy data processing framework reminiscent of MapReduce.'
tags: ['HBase']
keywords: ['hbase', 'filters', 'coprocessors']
published: true
author: Pavol Vidlička
---

- distributed NoSQL database built on top of Hadoop File System
- built for real-time access to big data

- powerful extension mechanisms with filters and coprocessors which allow to do custom filtering and processsing
  of data locally on regionservers before returning to the caller
- can be seen as a platform for building distributed systems and higher-level databases
  - mention Phoenix, Kylin, timeseries DB, HGraphDB

Common use-case is to store raw or partially aggregated data and do the final aggregation on request,
for example to populate a dashboard or do pre-defined analytical queries over a small slice of data.

I want to demonstrate how to build such a system by implementing a flexible general-purpose data-processing framework,
that can do aggregations on the fly

## HBase data model crash course

- mention Cell aka KeyValue - the basic unit of data
  - identified by (rowkey, CF, qualifier, timestamp(version))
  - split by rowkey into Regions, which can reside on different machines
  - physically stored in CFs within a single region
  - sorted by qualifier wihin a CF and row

You access data by doing a rowkey range scan and choosing CFs to include

You can model your data very flexibly, because everything is just bytes.
Wide column database - values in different columns are heterogenous.
Often homogenous, different "fields" are packed together (for example, Phoenix does that)

Regions are the units of parallelism

- The data in a given region are processed sequentially
- you get parallelism, the data needs to be split into multiple regions (maybe mention salting? - if you want to parallelize a query, the data it accessed need to be spread out)

## HBase (filter)MapReduce examples

- obligatory WordCount example (using shakespear)
- map and filter on regionservers
- two step reduce (analogous to fold)
  - intermediate result regionserver-side
  - final result client-side

### Shakespear dataset

- describe dataset and how it was created

### Some queries

- word count
- ...
- mention API docs
- it is not polished. Flex with Spark Encoders - something similar would allow to use higher level functions, not working with bytes all the time

## Translate into lower level API

- add filters to scan manually
- raw coprocessor call

## Filters

- callback based
- mention that they can also transform value - they are akin to mappers in MapReduce
- link FilterBase

## Endpoint coprocessors

- observer and endpoint differences (mention more on observers later - blog post)
- we use them to implement something similar to combiners
- the client acts as a single reducer
- contract
- embedded server

## Disclaimer section

- Do not use this in production
- custom serialization = bad idea
- remote code execution in your database
- overhead vs SLAs
- inline!

Some code

```java
import java.util.Scanner;

public class Life {

    // this a comment

    /**
    * <p>This is a simple description of the method. . .
    * <a href="http://www.supermanisthegreatest.com">Superman!</a>
    * </p>
    * @param incomingDamage the amount of incoming damage
    * @return the amount of health hero has after attack
    */
    @Override @Bind("One")
    public void show(boolean[][] grid){
        String s = "";
        for(boolean[] row : grid){
            for(boolean val : row)
                if(val)
                    s += "*";
                else
                    s += ".";
            s += "\n";
        }
        System.out.println(s);
    }

    public static void>main(String[] args){
        boolean[][] world = gen<T>();
        show(world);
        System.out.println();
        world = nextGen(world);
        show(world);
        Scanner s = new Scanner(System.in);
        while(s.nextLine().length() == 0){
            System.out.println();
            world = nextGen(world);
            show(world);

        }
    }
}
```

```scala
object EvenOdd {
  // evenOdd([], [], []).
  implicit def emptyList = new EvenOdd[HNil, HNil, HNil] {}

  // evenOdd([A], [A], []).
  implicit def oneElement[A] = new EvenOdd[A :: HNil, A :: HNil, HNil] {}

  // evenOdd([A, B | Tail], [A | TailEven], [B | TailOdd]) :-
  //     evenOdd(Tail, TailEven, TailOdd).
  implicit def atLeastTwoElements[
      A,
      B,
      Tail <: HList,
      TailEven <: HList,
      TailOdd <: HList
  ](
      implicit ev: EvenOdd[Tail, TailEven, TailOdd]
  ) =
    new EvenOdd[A :: B :: Tail, A :: TailEven, B :: TailOdd] {}
}
```
