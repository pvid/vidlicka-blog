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

Lorem ipsum, lorem impsum

## HBase data model crash course

- metion Cell aka KeyValue
- rowkey
- CF
- column
- versions

## HBase (filter)MapReduce examples

- obligatory WordCount example (using shakespear)
- map and filter on regionservers
- two step reduce (analogous to fold)
  - intermediate result regionserver-side
  - final result client-side

### Shakespear dataset

- describe dataset and how it was created

### Some queries

- wordcount
- ...
- mention API docs

## Translate into lower level API

- add filters to scan manually
- raw coprocessor call

## Filters

- callback based
- link FilterBase

## Endpoint coprocessors

- observer and endpoint differences (mention more on observers later - blog post)
- contract
- embedded server

## Do not use this in production

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
