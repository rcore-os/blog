---
title: <2024os训练营第一阶段rust学习总结-xik
date: 2024-04-25 22:26:19
categories:
    - os
tags:
    - author:Sharp010
    - repo:https://github.com/LearningOS/rust-rustlings-2024-spring-Sharp010
---

花了大约一周的时间基本看完了[rust圣经](https://course.rs/about-book.html)，两天刷完rustling，发现rust真是把各种安全考虑(内存,数据...)直接暴露给用户了。
---

😯rust三大支柱：

- 没有垃圾回收的内存安全（内存安全）
- 没有数据争用的并发（数据安全）
- 没有开销的抽象（性能）

[1]😯`无GC`: 随时回收内存啊，这不c++ RAII么，NLL比RAII更强！

[2]😯`所有权、借用`：最有特色的一章。这是直接把读写锁加在语言层了是吧。

[3]`生命周期`：最难理解的一章。NLL还好理解，给参数和返回值手动标生命周期怎么突然魔幻起来了🥵，好在编译器会帮我们做标注。

[4]`泛型、trait`：最惊艳的一章。泛型?大伙都有啊；trait? 这不Java的接口（c++虚函数）么，但是确实优化掉了继承，难道这就是`组合优于继承`么🧐；

😯零开销抽象!!

> 组合:用"has-a"(有什么或用什么)去替代"is-a"(是什么)
>
> 零开销抽象：极度强调运行时性能，把所有解释抽象的工作都放在编译时

[5]`函数式编程`：这不所有权+借用版本的c++迭代器和lambda表达式么

[6]`Box智能指针、循环引用`：这不所有权+借用版本的c++ unique_ptr,shared_ptr,weak_ptr的么

[7]`unsafe`：c++裸指针,但仍然无法逃离所有权和借用

[8]`多线程与并发`：大伙都有，但是更严格了啊，还得时刻考虑数据的位置和所有权转移



---

1.变量解构

```let (a, mut b): (bool,bool) = (true, false);```

2.数值

```61_f32```表示f32类型的61

3.as 转类型

例如```'a' as u8```

4.range

```1..5``` 和 ```1..=5```

5.```字符串```通过硬编码，而```String类型```在堆上

6.申请堆内存后，通过```栈中的堆指针```进行访问

7.一个值只能拥有一个所有者

> **变量在离开作用域后，就自动释放其占用的内存**

> 可以多个常量引用，但是只能有一个可变引用
>
> 可变引用和常量引用不能同时存在
>
> 引用的作用域在最后一次使用后时结束（编译器的优化）

```rust
let s1 = String::from("hello");
let s2 = s1;
//s1将所有权移交s2
```

8.字符串String 和 &str

> str是内置类型，String是标准库类型
>
> &str字符串切片

中文3个字节

9.尽量使用迭代方式访问数组    使用下标访问每次有越界检查

```for i in &v{}```

和 for i in v{} 的区别？

> 如果不使用引用的话，所有权会被转移（move）到 `for` 语句块中，后面就无法再使用这个集合了:(

> 对于实现了 `copy` 特征的数组(例如 [i32; 10] )而言， `for item in arr` 并不会把 `arr` 的所有权转移，而是直接对其进行了拷贝，因此循环之后仍然可以使用 `arr` 。



10.模式匹配

```rust
match some_u8_value {    
    1 => println!("one"),    
    3 => println!("three"),    
    5 => println!("five"),    
    7 => println!("seven"),    
    _ => (), 
}
```

`()` 表示返回**单元类型**与所有分支返回值的类型相同，所以当匹配到 `_` 后，什么也不会发生。

11.函数参数的三种传入方式：**转移所有权、可变借用、不可变借用**

12.只要闭包捕获的类型都实现了`Copy`特征的话，这个闭包就会默认实现`Copy`特征。

```rust
// 拿所有权
let s = String::new();
let update_string = move || println!("{}", s);

exec(update_string);
// exec2(update_string); // 不能再用了

// 可变引用
let mut s = String::new();
let mut update_string = || s.push_str("hello");
exec(update_string);
// exec1(update_string); // 不能再用了
```

**😎仅**实现 `FnOnce` 特征的闭包在调用时会转移所有权

13.调用第一个参数为self的成员函数会移交所有权，实例不能再使用

```rust
fn takes_long_type(f: Box<dyn Fn() + Send + 'static>) {    // --snip-- } 
```

14.数据内存布局

`Vec`、`String` 和 `HashMap`都是固定大小的类型,都是对堆上数据的引用，引用的大小是固定的，即`栈上的引用类型是固定大小的`

DST:不定长类型，**在代码中直接使用 DST 类型，将无法通过编译。**

Rust 中常见的 `DST` 类型有: `str`、`[T]`、`dyn Trait`，**它们都无法单独被使用，必须要通过`引用`或者 `Box` 来间接使用** 。

`dyn Trait`表示它所指定的 Trait，确切的原始类型被*删除*，补全 Trait 对象指针所需的信息是 `vtable` 指针，被指向的对象的运行时的大小可以从 `vtable` 中动态地获取。

```rust
struct MySuperSliceable<T: ?Sized> {
    info: u32,
    data: T,
}
```

`?Sized` 是一个特殊的 trait bound，表示泛型类型 `T` 可以是非固定大小类型。

`T` 既可以是普通的固定大小类型（如 `i32`, `u64`），也可以是动态大小类型（如 `str` 或者 `dyn Trait`）

`#[repr(c)]`  表示字段的顺序、大小和对齐方式与你在 C 或 C++ 中期望的完全一样。

通过 FFI (Foreign Function Interface，不同语言交互)边界的类型都应该有`repr(C)`，因为 C 是编程世界的语言框架。

15.堆栈

- 小型数据，在栈上的分配性能和读取性能都要比堆上高
- 中型数据，栈上分配性能高，但是读取性能和堆上并无区别，因为**无法利用寄存器或 CPU 高速缓存**，最终还是要经过一次内存寻址
- 大型数据，只建议在堆上分配和使用

栈的**分配速度**肯定比堆上快，但是**读取速度**往往取决于你的数据能不能放入**寄存器**或 CPU **高速缓存**。

将一个简单的值分配到堆上并没有太大的意义。将其分配在栈上，由于寄存器、CPU 缓存的原因，它的性能将更好.

16.智能指针往往都实现了 `Deref` 和 `Drop` 特征

Box可当智能指针用

17.Deref

- 把智能指针（比如在库中定义的，Box、Rc、Arc、Cow 等）从结构体脱壳为内部的引用类型，也就是转成结构体内部的 `&v`
- 把多重`&`，例如 `&&&&&&&v`，归一成 `&v`

```rust
// 由于 String 实现了 Deref<Target=str>    
let owned = "Hello".to_string();    // str
```

- 当 `T: Deref<Target=U>`，可以将 `&T` 转换成 `&U`，也就是我们之前看到的例子
- 当 `T: DerefMut<Target=U>`，可以将 `&mut T` 转换成 `&mut U`
  - 当 `T: Deref<Target=U>`，可以将 `&mut T` 转换成 `&U`

18.

`Rc` 只能用于同一线程内部，想要用于线程之间的对象共享，你需要使用 `Arc`

`Arc` 是线程安全的，Atomic Reference Count

> Arc并不允许直接修改其中的数据，应该在Arc内部包装一个mutex


---

`RefCell` 实际上并没有解决可变引用和引用可以共存的问题，只是将报错从编译期推迟到运行时，从编译器错误变成了 `panic` 异常

> borrow()    borrow_mut()

- `RefCell` 适用于编译期误报或者一个引用被在多处代码使用、修改以至于难于管理借用关系时

`Cell`对于实现了Copy的类型。如 Cell<i32>   使用.get()获取一个copy后的数据，使用.set()修改原来的数据 => 进而实现了可变借用和不可变借用同时存在。

---

`Weak`


使用Weak来解决循环引用导致的内存泄漏问题,也可直接使用unsafe 裸指针解决  ***裸指针没有所有权转移***  

> 通过RC创建Weak,或者直接创建Weak

---

`NonNull`  [一个非空,协变的裸指针]

19.unsafe

**创建原生指针是安全的行为，而解引用原生指针才是不安全的行为**

> unsafe代码块加在解引用裸指针的周围

将引用转化为裸指针是一种**😎再借用**

> **一旦开始使用裸指针，就要尝试着只使用它**,不然就会突破rust的引用规则和栈借用规则。产生不好的后果

**内部可变性**

一个不可变引用 `&UnsafeCell<T>` 指向一个可以改变的数据，这就是内部可变性。

20.再借用
f

21.Pin

自引用最麻烦的就是创建引用的同时，值的所有权会被转移

```rust
struct SelfRef<'a> {
    value: String,

    // 该引用指向上面的value
    pointer_to_value: &'a str,
}

fn main(){
    let s = "aaa".to_string();
    let v = SelfRef {
        value: s,               // 所有权转移 
        pointer_to_value: &s    // 所有权已经被转移，不能再借用
    };
}
```

22.线程安全

- 实现`Send`的类型可以在线程间安全的传递其所有权
- 实现`Sync`的类型可以在线程间安全的共享(通过引用)

23.`常量`可以在任意作用域进行定义，其生命周期贯穿**整个程序的生命周期**。

Rust 要求必须使用`unsafe`语句块才能访问和修改`static`变量

`lazy_static`懒初始化静态变量，之前的静态变量都是在编译期初始化的，因此无法使用函数调用进行赋值，而`lazy_static`允许我们在运行期初始化静态变量！但是定义的静态变量都是`不可变引用`。

`Rust`为我们提供了`Box::leak`方法，它可以将一个变量从内存中泄漏(听上去怪怪的，竟然做主动内存泄漏)，然后将其变为`'static`生命周期，最终该变量将和程序活得一样久，因此可以赋值给全局静态变量`CONFIG`。


24.`unwarp`通过unwarp() 取出Result<i32,ParseIntError>中的i32（潜在panic）

使用`?`方法后接收option或result时，遇到err,None直接返回

25.iterator

`三种迭代器类型`

`IntoIter` 类型迭代器的 `next` 方法会拿走被迭代值的所有权，`IterMut` 是可变借用， `Iter` 是不可变借用。

🥵26.链表


不能直接将head的所有权直接移交给新节点的next。take将head偷出,填入None，返回head

加泛型后head为Option<Box<Node<T>>>

---


不使用as_ref会将head的所有权移入map函数内(map的函数签名为self,转移所有权)，这样&node.elem就是返回map函数内的局部变量的引用。

使用as_ref将Option<Box<Node<T>>> 转为 Option<&Box<Node<T>>>解决问题



27.逆变协变

一个variable被拆分成‘读’跟‘写’，其中读的部分是协变，写的部分是逆变，可读可写的var则是不变

协变：需要动物的地方给一个猫   

逆变：需要猫的地方给一个动物 

不变：不能转换

> rust中函数返回的是协变的，参数是逆变的
>
> rust中生命周期和泛型T都有协变逆变性

> *mut T 对于T是不变的    &'a mut T  对于T是不变的
>
> 引入NonNUll包裹T，这时T是协变的
>
> 在构建list时，使用*mut Node<T> 会导致不能使用其协变性。用NonNull引入协变性

例子:

```rust
fn assign<T>(input: &mut T, val: T) {
    *input = val;
}
fn main() {
    let mut hello: &'static str = "hello";
    {
        let world = String::from("world");
        assign(&mut hello, &world);
    }
    println!("{hello}");
}
// 这里传入assign的T为hello,hello是一个&'static str类型，即T是&'static str，它是不变的，不能用&'world str类型的val(第二个参数)来

```

`NonNull<T>` 是关于 `T` 协变的。这意味着如果你有一个 `NonNull<T>`，并且 `U` 是 `T` 的子类型，那么你可以将 `NonNull<T>` 转换为 `NonNull<U>`。这种属性在泛型编程中非常有用，尤其是在处理继承或类型转换时。

子类型:

1. **引用的子类型关系**：在 Rust 中，引用 `&T` 是其指向的类型 `T` 的子类型。这意味着，如果有一个函数期望接受类型 `T` 的参数，你可以传递类型为 `&T` 的参数给它，而编译器会自动进行引用的解引用操作。这样的设计避免了数据的不必要的拷贝，并且使得代码更加灵活。
2. **安全的子类型关系**：在 Rust 中，如果一个类型 `B` 实现了 trait `A`，那么 `B` 就是 `A` 的子类型。这种子类型关系通过 trait 来实现。比如，如果类型 `String` 实现了 trait `AsRef<str>`，那么 `String` 就是 `str` 的子类型。这种关系允许你在期望 `AsRef<str>` 类型参数的地方传递 `String` 类型的值。
3. **Enum 的子类型关系**：在 Rust 中，Enum 可以有多个变体（variants），这些变体可以拥有不同的数据类型。对于一个枚举类型来说，它的每个变体都可以被认为是它本身的子类型。这种设计在模式匹配和组合类型时非常有用。

28.module

当使用 `mod` 语句导入模块时，Rust *自动* 为它创建一个模块命名空间

> mod logging;            可以使用logging::xxx访问该module下的内容

`extern`

1.调用外部代码

```rust
extern "C" {
 fn ctanf(z: Complex) -> Complex;
}
```

2.外部调用rust代码

```rust
pub extern "C" fn rustfn1() { }
```

29.多态

- 泛型是一种 **编译期多态** (Static Polymorphism)，在编译一个泛型函数的时候，编译器会对于所有可能用到的类型进行实例化并对应生成一个版本的汇编代码，在编译期就能知道选取哪个版本并确定函数地址，这可能会导致生成的二进制文件体积较大；

- 而 Trait 对象（也即上面提到的 `dyn` 语法）是一种 **运行时多态** (Dynamic Polymorphism)，需要在运行时查一种类似于 C++ 中的 **虚表** (Virtual Table) 才能找到实际类型对于抽象接口实现的函数地址并进行调用，这样会带来一定的运行时开销，但是更为灵活。
