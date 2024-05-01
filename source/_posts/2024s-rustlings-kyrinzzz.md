---
title: 2024s-rustlings-kyrinzzz
date: 2024-04-29 17:39:16
categories:
	- report
tags:
	- author:kyrinzzz
	- repo:https://github.com/LearningOS/rust-rustlings-2024-spring-kyrinzzz
	- report
---



>have done the orginal rustlings test before, try again and also get something to learn
>
>not only the tech an trick experience , but also the design philosophy behind the language.

# RoadBlock

## 0 variales

### varaibles5.rs

- `shadowing`: use `let`

## 1 primitive_types

### primitive_types3.rs

- shorthand to create an arry: `[elment; times]`

### primitive_types4.rs

- Ownership, borrow, ref: &
- slice: [ .. ]

## 2 vector

### vecs1.rs

- Vec::new()
- macro: vec![elements... ]

### vecs2.rs

- two ways
  - direct: use `*`
  - map:
- used to do in the `*` way, now prefer the `map` way

## 3 move_semantics

### move_semantics1.rs

- ownership, borrow: the new va. takes the ownership from the old, the old can not be accessible
- mutable

### move_semantics2.rs

- clone()
- mutally borrow a reference to its argument: the next exec

### move_semantics6.rs

- ownership

## 4 struct

### structs3.rs

- `self`

## 5 enums

### enums3.rs

- `match`

  ``` Rust
  match expr1 {
      type1 => { expr2 },
      type2(var) => { expr3 },
      _ => {}
  }
  
  ```

- match allows us to compare a value to a series of patterns and execute the code based on the matching pattern

  - A pattern can consist of literal quantities, variables, wildcards, and many other things
  - bind partial values of matching patterns

- the return value of one branch is the return value of the whole match expection

## 6 strings

### string1.rs

- lifetime
- to_string()
- From

### strings3.rs

- RTFD(RTFM): Read the fxxxx document(mannul)
- STFW

### string4.rs

- std

## 7 modules

### modules1.rs

- private default
- `pub`

### modules2.rs

- `use xx as xxx`

### modules3.rs

- `use xx :: {yy, zz}`

## 8 HashMap

### hashmap1.rs

- <key, value>
- Hash::new()
- insert()

### hashmap2.rs

- `entry()` and `or_insert()`

### hashmap3.rs

- well, read the answer I wrote last time
- have ideas, but stuck on &mut T

## quiz2.rs

- stuck on modules and strings for a while

## 9 Options

### options1.rs

- Option<T>, Some(), None
- unwrap() or match
- read the answer of match way

### options2.rs

- `if let` statement and `while let` statement
- read the answer: think in the reverse way, .unwrap() -- Some()

### options3.rs

- >Bind by reference during pattern matching.
  >ref annotates pattern bindings to make them borrow rather than move.
  >It is not a part of the pattern as far as matching is concerned: it does not affect whether a value is matched,
  >only how it is matched.

## 10 error_handling

### error1.rs

- Result<T, E>
  - Ok(T)
  - Err(E)

### error2.rs

- ? -- match

- >If the value of Result is OK, the expression will return the value in OK and the program will continue.
  >If the value is Err, Err is used as the return value for the entire function,
  >as if the return keyword were used, so that the error value is propagated to the caller.

### error3.rs

- the ? is valid only in function that -> Result<T, E>
- in main function, use `()` to present nothing needed

### error4.rs

- kind of read the answer

### error5.rs

- trait
- Box\<T\>: A pointer type that uniquely owns a heap allocation of type T.
- dyn

### error6.rs

- stuck, read the answer; .map_err()

## 11 generics

### generics2.rs

- `<T>`
  - functions: fn func_name<T>(arg: T) -> T
  - structs: struct StructName<T>
  - traits: trait TraitName<T>
  - impl<T> StructName<T> { ... }

## 12 traits

### traits1.rs

- trait: A trait defines a set of behaviors that can be shared, and once the train is implemented,
- you can use that set of behaviors.
  - similar to interface
- trait trait_name { ... }
  - impl trait_name for StructName { ... }

### traits4.rs

- traits as parameters

### traits5.rs

- multiple traits: impl Trait1 + Trait2 + Trait3 for StructName { ... }

## quiz3.rs

- stuck, but according to the compiler info, fix it

## 13 lifetimes

### lifetimes1.rs

- lifetime: When returning a reference from a function,the lifetime parameter for the return type needs
- to match the lifetime parameter for one of the parameters
  - follow the compiler
  - 'a: fn funcName<'a>(x : 'a i32) -> &'a str

### lifetimes2.rs

- same mark, same lifetime
- paths:
  - make y live longer
  - make println! inner

### lifetimes3.rs

- lifetime in struct: struct StructName<\'a> { field: \'a type1 }

## 14 tests

### tests1.rs

- assert!(condition, "{}", message)

### tests4.rs

- attribute `should_panic`

## 15 iterators

### iterators1.rs

- iter(), next ()

### iterators3.rs

- `.map()`, `collect()`

### iterator4.rs

- `into_iter()` and `fold()`: e.g. iterator.fold(initial_value, |acc, x | { acc + x })

- >The fold() method is similar to the iterator’s forEach() method, but it returns a value.

- >Folds every element into an accumulator by applying an operation, returning the final result.

  >fold() takes two arguments: an initial value, and a closure with two arguments: an ‘accumulator’, and an element.
  >The closure returns the value that the accumulator should have for the next iteration.

  >The initial value is the value the accumulator will have on the first call.

  >After applying this closure to every element of the iterator, fold() returns the accumulator.

  >This operation is sometimes called ‘reduce’ or ‘inject’.

>

### iterators5.rs

- more familiar with the `iter()`, `map()` and `fold()`

## 16 smart_pointers

### box1.rs

- compile time
- `Box`: a smart pointer used to store data on the heap, which also allows us to wrap a recursive type.

### rc1.rs

- `Rc<T>`: used for multiple owners
- `clone()`, `Rc::clone()`  and `drop()`

### arc1.rs

- Arc<T>: used for multiple owners, but it is thread-safe
- `clone()`

### cow1.rs

- Cow(Copy-On-Write type): It can enclose and provide immutable access to borrowed data,<br>
  and clone the data lazily when mutation or ownership is required.<br>
  The type is designed to work with general borrowed data via the Borrow trait.
- `Cow::Owned()` and `Cow::Borrowed()`
- well, this is a little confusing, got stuck; solved by simulating the code above TODOs and the answer wrote before

## 17 threads

### threads1.rs

- `thread::spawn()`: create a new thread and run the closure in it; -> JoinHandle<T>
- `move`: move the value into the closure
- `join()`: wait for the thread to finish, return the result

### threads2.rs

- `Mutex<T>`: A mutex is a mutual exclusion primitive that can be used to protect shared data<br>
  - `lock()` : -> LockResult<MutexGuard<'_, T>>
- `Arc<T>`:

### threads3.rs

- `std::sync::mpsc`: multi-producer, single-consumer channel, sending end and receiving end
- `clone()`
- well, I did get stuck on this one last time, this time go smoothly.

## 18 macros

The term `macro` refers to a family of features in Rust:

- declarative macros with `macro_rules!` and
- three kinds of `procedural` macros:
  - Custom `#\[derive\]` macros that specify code added with the `derive` attribute used on structs and enums
  - Attribute-like macros that define custom attributes usable on any item
  - Function-like macros that look like function calls but operate on the tokens specified as their argument

### macros2.rs

- the order of definition and use matters

### macros3.rs

- `[macro_use]`

### macros4.rs

- use `;` to separate the macro arms

## 19 clippy

### clippy1.rs

- `constant s`

### clippy2.rs

- `let Some(x) = option`
- there was a bug, solved

### clippy3.rs

- `std::mem::swap`, `vec.clear()`

## 20 conversions

### using_as.rs

- `as` operator: type casting and renaming imports

### from_into.rs

- The From trait is used for value-to-value conversions. If From is implemented correctly for a type,<br>
  the Into trait should work conversely.
- copilot this time; I dit get stuck on this last time for a while, solved eventually
- `impl From\<T\> for U`

### from_str.rs

- copilot this time; did get stuck on this last time for a while, solved eventually
- `iterators`: `next()`, `last()`
- `parse::\<T\>()`

### try_from_into.rs

- `TryFrom` and `TryInto` traits are provided by the standard library to support this conversion.
  - `impl TryFrom\<From\> for To` and  `-> Result\<T, E\>`
- `tuple` and `array` will be checked at compile time, `struct` will be checked at runtime,
- `slice` implementation needs to check the slice length,

### as_ref.rs

- `trait bound`: `AsRef\<T\>` and `AsMut\<T\>`

## 21 tests-II

### tests5.rs

- `unsafe`: `item declaration` and `code block`
- The `unsafe` keyword has two uses:
  - to declare the existence of contracts the compiler can’t check (unsafe fn and unsafe trait),
  - and to declare that a programmer has checked that these contracts have been upheld (unsafe {} and unsafe impl, <br>
    but also unsafe fn – see below).
- confusing

### tests6.rs

- `Box`: `Box::into_raw()` and `Box::from_raw()`

### tests7.rs || build.rs || tests8.rs

- `build.rs`
  - Building a bundled C library.
  - Finding a C library on the host system.
  - Generating a Rust module from a specification.
  - Performing any platform-specific configuration needed for the crate.

### test9.rs

- ABI
- extern 
  - "C" for C-like ABI, "stdcall" for Windows ABI, "C++" for C++ ABI, <br>
    "Rust" for Rust ABI, "system" for system ABI"
  - #\[linkname = ".."\]
  - export symbol to the linking environment, e.g. `extern "C" fn funcName()`
- mangle symbol name: `#\[no_mangle\]
- confused, copilot; the attributes should be applied properly

## 22 algorithm

### algorithm1.rs -- merge linked list

- got stuck for a long time, not the fault of not understanding linked list, but those features
- `impl<T: PartialOrd + Clone>`: a trait bound that specifies requirements for the type T.

### algorithm2.rs -- reverse double linked list

- a little confused, but solved

### algorithm3.rs -- sort, bubble sort

- copilot for `the trait Ord`

### algorithm4.rs -- bst, the binary search tree

- glad it's not avl tree
- recursion

### algorithm5.rs -- bfs, adjacency matrix

- `VecDeque`, `bfs`, `visited`,  `Adjacency matrix`
- familiar with this one, with `VecDeque`, solved quickly

### algorithm6.rs -- dfs, adjacency matrix

- smooth

### algorithm7.rs -- stack, vec

- copilot when the match arm

### algorithm8.rs -- impl stack with queues

- with one queue
  - push: just push 
  - pop: pop the pre and push them again, loop queue.size - 1 times
- with two queues -- this way this time
  - make sure that the new element is in the front of the queue, and one queue is empty
  - use one empty queue q1 to store the new, move the rest of elements from the other queue q2 to the cur queue q1, 
  - then use the other queue q2 to store the next new element, move the rest of elements from the cur queue q1 to the other queue q2,

### algorithm9.rs -- binary heap

- although aware of that heap keeps the smallest or the biggest element at the top, often used in the k-th min or max problem
- not so familiar with this one, stfw, gpt, copilot
- use vec to implement heap: the parent's index `(i - 1) / 2`, the left child's index `2 * i + 1`, the right child's index `2 * i + 2`, start from 0
- `add`: after `push`, use `heapify_up`
- `heapify_up`: continuous swap until the parent is smaller(or greater, depending on the heap type) than the child
- `smallest_child_idx`: the smallest child idx
- `next`: iterate to get the smallest element

### algorithm10.rs -- graph: adjacency table, undirected graph

- copilot a little for programming quickly, like finding elem in hashmap, trying to insert new elem into hashmap

