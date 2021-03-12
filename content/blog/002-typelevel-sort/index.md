---
slug: type-level-merge-sort
date: 2021-03-12
title: 'Type-level merge sort in Scala'
description: 'Translate a Prolog algorithm into the Scala type system'
tags: ['Scala']
keywords: ['scala', 'type-level', 'prolog', 'mergesort']
published: true
author: Pavol Vidlička
---

Let's do some type-level programming!
I want to show you how to (ab)use
Scala's type system to implement an a type-level merge sort.
The idea to use types and implicit search to create programs that run during
compilation is nothing new. You can even easily find
[more](https://jto.github.io/articles/typelevel_quicksort/)
[than](https://milessabin.com/blog/2012/01/27/type-level-sorting-in-shapeless/)
[enough](https://blog.rockthejvm.com/type-level-programming-part-3/)
blog posts on type-level sorting alone. My spin on it is that I write the algorithm
in Prolog and then translate the clauses into Scala constructs and show you how
to use implicit search as a inference engine.

A reason to do this is that the techniques used to implement something as silly
as type-level sorting can be used to do some useful stuff as well.
An example is compile-time constraint checking - let's say that you are writing
a generic serialization framework for case classes, but you want to reject
case classes that contain more than one String field.
The problem is that expressing such a constraint using Scala types
is verbose and obtuse. Being able to translate various advanced patterns
that the implicits into logical clauses will allow you to understand them better.

You can find the full Scala implementation in a [Github gist](https://gist.github.com/pvid/bf3fac21cff3590140e5a3cbf1d831bd)
and also a runnable version [in Scastie](https://scastie.scala-lang.org/5XModyzbQBeZBOzRMO1o2w)
if you want to poke around it a bit.

We won't go over the full implementation in detail, but you are encouraged
to read and understand it using the ideas from the rest of this article.

# Algorithm in Prolog

The prolog implementation is relatively straight-forward. It

- recursively splits a list into smaller lists (the split algorithm
  we use splits the list based on the parity of element's index)
- merges the partial lists so that the result of the merger is sorted
  if the input lists are sorted

```prolog
evenOdd([], [], []).
evenOdd([A], [A], []).
evenOdd([A, B | Tail], [A | TailEven], [B | TailOdd]) :-
    evenOdd(Tail, TailEven, TailOdd).

split(Input, First, Second) :- evenOdd(Input, First, Second).

merge([], Second, Second).
merge([FirstHead | FirstTail], [], [FirstHead | FirstTail]).
merge([FirstHead | FirstTail], [SecondHead | SecondTail], [FirstHead |Merged]) :-
    FirstHead =< SecondHead,
    merge(FirstTail, [SecondHead |SecondTail], Merged).
merge([FirstHead | FirstTail], [SecondHead | SecondTail], [SecondHead | Merged]) :-
    FirstHead > SecondHead,
    merge([FirstHead | FirstTail], SecondTail, Merged).

mergeSort([], []).
mergeSort([A], [A]).
mergeSort(Input, Sorted) :-
    split(Input, First, Second),
    mergeSort(First, FirstSorted),
    mergeSort(Second, SecondSorted),
    merge(FirstSorted, SecondSorted, Sorted).
```

# Scala re-implementation

We will be using the [shapeless](https://github.com/milessabin/shapeless).
More specifically, we will use two of its many features:

- `HList` which acts as type-level linked list. It can be either
  - empty - `HNil`
  - "cons" of a head and a tail - `::[H, T]` equivalently written `H :: T`
    where `H` is any type
    and `T` is a subtype of `HList`
- type-level natural numbers `_1`, `_2`, `_3`, ... and types that represent
  how they are ordered: `LTEq[_, _]` and `GT[_, _]`. They are implemented
  by translating [Peano axioms](https://en.wikipedia.org/wiki/Peano_axioms)
  into Scala's type system

Shapeless' HList has a lots of features, but "linked list" is quite easy to do.
The same goes for translating Peano axioms - it just takes quite a bit of work.

## The inference engine

The inference engine that our type-level program will use is already built
into Scala - implicit resolution. The compiler uses implicit values
and implicit defs to synthesize a requested implicit parameter
when we call a function that has those.

The simplest of such functions can be found in the standard library

```scala
def implicitly[T](implicit e: T): T = e
```

it requests a value of a given type. Functions with implicit parameters
can be used to "query" the inference engine.

## Propositions as types

The phrase "propositions as types" is one of those fancy terms often found
in fancy CS. However, the concept is very useful for understanding
when implicit search fails.

The notion describes a correspondence between logical statements
(e.g. `1 < 5` - a predicate about arithmetics) and types
(`LT[_1, _5]` in shapeless). It also states that *proofs* of logical statements
correspond to programs that produce values of corresponding *types*.

This explains why the snippet

```scala
import shapeless.ops.nat._
import shapeless.nat._

implicitly[LT[_1, _5]]
```

compiles and the snippet

```scala
import shapeless.ops.nat._
import shapeless.nat._

implicitly[GT[_1, _5]]
```

fails with

```could not find implicit value for parameter e: shapeless.ops.nat.GT[shapeless.nat._1,shapeless.nat._5]
```

In the first case, the compiler can use Peano axioms encoded into implicit values
and definition in `shapeless` to summon a value of the type `LT[_1, _5]`.
In other words, the compiler *constructs a proof* of `1 < 5`.
However, it cannot summon a value of type `GT[_1, _5]` because `1 > 5`
if *not true*.

Armed with an inference engine and an intuition about how types relate
to propositions, let's do some logic programming!

## Predicates and clauses using Scala's implicits

Prolog predicates will be represented using Scala's types.

For example, predicate

```prolog
evenOdd(X, Y, Z)
```

which represents the proposition that "Y and Z are the results of splitting list
X into elements at even indices (Y) and odd indices (Z)".
Note that we are using zero-based indexing.

In Scala, the **proposition** will be represented by

```scala
trait EvenOdd[Input, Even, Odd]
```

Now we need to supply some facts and rules that allow us to
"prove" that we can split some inputs into even and odd elements.
To do that, we need to provide the compiler with same values
of the type and ways to summon new values.

**Facts** are that contain only constants are represented by implicit values

```scala
// evenOdd([], [], []).
implicit val emptyList = new EvenOdd[HNil, HNil, HNil] {}
```

Facts that have universally qualified variables are represented using
implicit definitions

```scala
// evenOdd([A], [A], []).
implicit def oneElement[A] = new EvenOdd[A :: HNil, A :: HNil, HNil] {}
```

The definition above states that for every type `A`, we can construct
a value of type `EvenOdd[A :: HNil, A :: HNil, HNil]` (which we prove
by actually constructing it).

The last thing that we need is to represent **rules**. This will
be a bit more complex.

```scala
// evenOdd([A, B | Tail], [A | TailEven], [B | TailOdd]) :-
//     evenOdd(Tail, TailEven, TailOdd).
implicit def atLeastTwoElements[
    A,
    B,
    Tail <: HList,
    TailEven <: HList,
    TailOdd <: HList
](implicit
    ev: EvenOdd[Tail, TailEven, TailOdd]
): EvenOdd[A :: B :: Tail, A :: TailEven, B :: TailOdd] =
  new EvenOdd[A :: B :: Tail, A :: TailEven, B :: TailOdd] {}
```

We need to explicitly define all our universally qualified
types by defining them as type parameters. We are also repeating
the type of the result in the return type and also the instantiation
of the anonymous class. The important part is actually only

```scala
// evenOdd([A, B | Tail], [A | TailEven], [B | TailOdd]) :-
//     evenOdd(Tail, TailEven, TailOdd).
implicit def atLeastTwoElements[...](
  implicit ev: EvenOdd[Tail, TailEven, TailOdd]
): EvenOdd[A :: B :: Tail, A :: TailEven, B :: TailOdd] =
  ...
```

Comparing the it with the Prolog version, we see that the implicit
parameters correspond to the *body* of the rule
and the return type to the *head* of the rule (where `head :- body`).
We could translate it into human language by saying
`EvenOdd[A :: B :: Tail, A :: TailEven, B :: TailOdd]` is true if
`EvenOdd[Tail, TailEven, TailOdd]` is true.

The implicit parameter of type `EvenOdd[A :: B :: Tail, A :: TailEven, B :: TailOdd]`
is named `ev`, short for "evidence" - because its existence is evidence that
the statement the type represents is true. The parameter is also sometimes
called a "witness" for a similar reason. Note that compared to Prolog, Scala
forces us to give a name to our rules also to all members of the rule body.
This can be use to document what they represent.

You can model a body consisting of a conjunction of multiple predicates
by having multiple implicit parameters.

There is also a way to represent disjunction. However, that is more
difficult, because Scala's implicit needs the implicit resolution
to be unambiguous. That is, you cannot have more one implicit
value of a given type. You need to use the
["lower priority implicits" pattern](https://stackoverflow.com/questions/33544212/explain-the-lowpriorityimplicits-pattern-used-in-scala-type-level-programming).
The pattern is tied to the algorithm the compiler uses to come up with
implicit values.

Using these three patterns, we can construct the rest of the predicates
used in the merge sort implementation. Namely

**`Split`** - it is just an alias for `EvenOdd`

**`Merge`** - this is the most involved part of the implementation.
Its rules involve the `LTEq` and `GT` types and multi-predicate
bodies. However, it contains nothing new - it is just a more
complex application of concepts presented above.

The last part of the puzzle is the `MergeSort` trait.
This represents the actual sorting.
It starts with defining some base bases for the recursion
(sorting of an empty list and of a list with one element).
Then there is the `sortAtLeastTwo` implicit def.
It has lots of type parameters, but again, they are just boilerplate.
It expresses the notion that if

1. We can split the list into two smaller lists
1. Sort both of the smaller lists
1. Merge the sorted lists together (into a sorted list)

then we can sort the original list.
Just like something straight from a lecture on induction.

## Querying the results

All we need now is a way to query  the inference engine
to actually get a result of our type-level sort.

What we want is a Scala equivalent of

```prolog
?- mergeSort([5, 1, 3], X)
```

A problem that we need solve is that generic parameters
are actually not present in the compiled JVM bytecode due to type erasure.
However, we can ask the compiler, to get a `TypeTag` - lossless runtime
representation of a Scala type. We just need to define a function
with an implicit parameter with type `TypeTag[_]`

```scala
def typelevelSort[Input, Output](input: Input)(implicit
    ev: MergeSort[Input, Output],
    typeTag: TypeTag[Output]
): String = typeTag.toString
```

The first implicit parameter `ev` will ask the compiler
to synthesize a type representing our merge sort algorithm.
The second is the aforementioned type tag.

```scala
typelevelSort(_5 :: _1 :: _3 :: HNil) // TypeTag[shapeless.nat._1 :: shapeless.nat._3 :: shapeless.nat._5]
```

# That's all Folks!

We have shown how to translate a Prolog program into a Scala type-level
computation.
Doing a type-level merge sort is truly a weird flex and essentially useless.
Tune in next time to see a more practical example of these techniques.
We'll be writing a type class based codec for a serialization format
that is valid only for a certain subset of case classes.

We are going to translate the condition into types
and validate it at compile-time, so that it is impossible
to compile the codec for an unsuitable case class.
