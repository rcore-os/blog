---
title: Rust语言初步以及Rustlings错题整理
date: 2024-04-26 15:37:38
categories:
  - 2024春夏季开源操作系统训练营
tags:
  - author:vvw12345
---

# RUST语言初步及Rust错题整理

## 写在前面

​	这篇博客可能长度有点长（~~逃~~），因为之前没get到要求，以为blog是从二阶段才开始要写hhhh，所以从来没写过就是了hhh~~

​	这篇blog的主要内容是将我在学习RUST期间所做的笔记做一个整理（主要是来自于RUST语言圣经的节选）以便于自己后续回顾，以及将RUSTLINGS习题集中一些值得标注的语法问题做了记录。

​	:cry:二阶段得好好写了hhhh

## RUST语言圣经笔记

### 数据类型

1. 数据类型

   - 数值类型: 有符号整数 (`i8`, `i16`, `i32`, `i64`, `isize`)、 无符号整数 (`u8`, `u16`, `u32`, `u64`, `usize`) 、浮点数 (`f32`, `f64`)、以及有理数、复数
     - Nan表示未被定义的结果
     - debug模式检查整数溢出，release不会管
     - 浮点数不支持判等(eq操作未实现)
   - 字符串：字符串字面量和字符串切片 `&str`
   - 布尔类型： `true`和`false`，1个字节
   - 字符类型: 表示单个 **Unicode 字符**，存储为 **4 个字节**
   - 单元类型: 即 `()` ，其唯一的值也是 `()`

   一般来说不用显式声明，RUST编译器有变量推导

   比较逆天的话就不行了……

   ```rust
   let guess = "42".parse().expect("Not a number!");//推导不了
   
   //确定类型的三种方式
   // 编译器会进行自动推导，给予twenty i32的类型
   let twenty = 20;
   // 类型标注
   let twenty_one: i32 = 21;
   // 通过类型后缀的方式进行类型标注：22是i32类型
   let twenty_two = 22i32;
   ```

2. 序列

   生成**连续值**，只允许用于数字和字符类型（编译器可在编译期确定类型和判空）

   ```rust
   for i in 1..=5 {
       println!("{}",i);
   }
   
   for i in 'a'..='z' {
       println!("{}",i);
   }
   ```

3. 函数

   {% asset_img D:\116\sigs\blog\source\_posts\Rust语言初步以及Rustlings错题整理 functions%}

```rust
fn add(i: i32, j: i32) -> i32 {
   i + j
 }
```

- 特殊返回类型

  - 无返回值

    - 函数没有返回值，那么返回一个 `()`
    - 通过 `;` 结尾的语句返回一个 `()`

  - 发散函数：永不返回

    用`!`作为函数的返回类型





### 所有权和借用

1. C和RUST的内存管理差别

   ```c
   int* foo() {
       int a;          // 变量a的作用域开始
       a = 100;
       char *c = "xyz";   // 变量c的作用域开始
       return &a;
   }                   // 变量a和c的作用域结束
   //a是常数，被放在栈里，函数返回时出栈，a被回收，&a是悬空指针
   //c是字符串常量，在常量区，整个程序结束之后才会回收常量区
   ```

2. 所有权规则

   - Rust 中每一个值都被一个变量所拥有，该变量被称为值的所有者

   - 一个值同时只能被一个变量所拥有，或者说一个值只能拥有一个所有者

   - 当所有者(变量)离开作用域范围时，这个值将被丢弃(drop)

   ```rust
   let x = 5;
   let y = x;
   //浅拷贝，两个变量都依然有效
   
   let s1 = String::from("hello");
   let s2 = s1;
   //变量移动，默认是只copy指针，不会复制其实际内容
   //s1失效，s2接管那片内存空间
   
   let s1 = String::from("hello");
   let s2 = s1.clone();
   //你真想赋值的时候复制其内容，用clone()方法
   
   let x: &str = "hello, world";
   let y = x;
   //浅拷贝，"hello, world"是字符串字面量
   ```

   Copy特征：一个旧的变量在被赋值给其他变量后仍然可用，也就是赋值的过程即是拷贝的过程。**任何基本类型的组合可以 `Copy` ，不需要分配内存或某种形式资源的类型是可以 `Copy` 的**。

   - 所有整数类型，比如 `u32`
   - 布尔类型，`bool`，它的值是 `true` 和 `false`
   - 所有浮点数类型，比如 `f64`
   - 字符类型，`char`
   - 元组，当且仅当其包含的类型也都是 `Copy` 的时候。比如，`(i32, i32)` 是 `Copy` 的，但 `(i32, String)` 就不是
   - 不可变引用 `&T` ，例如[转移所有权](https://course.rs/basic/ownership/ownership.html#转移所有权)中的最后一个例子，**但是注意: 可变引用 `&mut T` 是不可以 Copy的**

3. 函数传值和返回——所有权的不断变化

   ```rust
   fn main() {
       let s1 = gives_ownership();         // gives_ownership 将返回值
                                           // 移给 s1
   
       let s2 = String::from("hello");     // s2 进入作用域
   
       let s3 = takes_and_gives_back(s2);  // s2 被移动到
                                           // takes_and_gives_back 中,
                                           // 它也将返回值移给 s3
   } // 这里, s3 移出作用域并被丢弃。s2 也移出作用域，但已被移走，
     // 所以什么也不会发生。s1 移出作用域并被丢弃
   
   fn gives_ownership() -> String {             // gives_ownership 将返回值移动给
                                                // 调用它的函数
   
       let some_string = String::from("hello"); // some_string 进入作用域.
   
       some_string                              // 返回 some_string 并移出给调用的函数
   }
   
   // takes_and_gives_back 将传入字符串并返回该值
   fn takes_and_gives_back(a_string: String) -> String { // a_string 进入作用域
   
       a_string  // 返回 a_string 并移出给调用的函数
   }
   ```

4. 引用

   ```rust
   fn main() {
       let s1 = String::from("hello");
   
       let len = calculate_length(&s1);//传入的是引用而不是所有权
   
       println!("The length of '{}' is {}.", s1, len);
   }
   
   fn calculate_length(s: &String) -> usize {
       s.len()//拿到的是引用，因此函数结束的时候不会释放所有权
   }
   
   ————————————————
   //引用默认不可变（就是你不能动你借用的东西的值）
   fn main() {
       let mut s = String::from("hello");//可变引用（可以修改借用的东西）
   
       change(&mut s);
   }
   
   fn change(some_string: &mut String) {
       some_string.push_str(", world");
   }
   
   ————————————————
   //在同一个作用域只可以存在一个可变引用（互斥锁懂我意思吧……）
   let mut s = String::from("hello");
   
   let r1 = &mut s;
   let r2 = &mut s;//r1的作用域还没寄，你怎么也搞个可变
   
   println!("{}, {}", r1, r2);
   
   
   ————————————————
   //可变和不可变引用不能同时存在
   let mut s = String::from("hello");
   
   let r1 = &s; // 没问题
   let r2 = &s; // 没问题
   let r3 = &mut s; // 大问题
   
   println!("{}, {}, and {}", r1, r2, r3);
   ```

   引用的作用域 `s` 从创建开始，一直持续到它最后一次使用的地方，这个跟变量的作用域有所不同，变量的作用域从创建持续到某一个花括号结束。

   ```rust
   fn main() {
      let mut s = String::from("hello");
   
       let r1 = &s;
       let r2 = &s;
       println!("{} and {}", r1, r2);
       // 新编译器中，r1,r2作用域在这里结束
   
       let r3 = &mut s;
       println!("{}", r3);
   } // 老编译器中，r1、r2、r3作用域在这里结束
     // 新编译器中，r3作用域在这里结束
   //Non-Lexical Lifetimes(NLL)特性：用于寻找到某个引用在`}`之前就不再被使用的位置
   ```

   悬垂引用在Rust是不会存在的，因为当你获取数据的引用后，编译器可以确保数据不会在引用结束前被释放，**要想释放数据，必须先停止其引用的使用**。

   ```rust
   fn main() {
       let reference_to_nothing = dangle();
   }
   
   fn dangle() -> &String {
       let s = String::from("hello");
   
       &s//悬垂引用，会报错
       //解决办法是直接返回s，也就是交出其所有权
   }
   ```



### 复合类型

#### 字符串和切片

1. **Rust 中的字符是 Unicode 类型，因此每个字符占据 4 个字节内存空间，但是在字符串中不一样，字符串是 UTF-8 编码，也就是字符串中的字符所占的字节数是变化的(1 - 4)**。

2. 为啥 `String` 可变，而字符串字面值 `str` 却不可以？

   就字符串字面值来说，我们在编译时就知道其内容，最终字面值文本被直接硬编码进可执行文件中，这使得字符串字面值快速且高效，这主要得益于字符串字面值的不可变性。不幸的是，我们不能为了获得这种性能，而把每一个在编译时大小未知的文本都放进内存中（你也做不到！），因为有的字符串是在程序运行的过程中动态生成的。

3. String和&str的转换

   ```rust
   //从&str生成String
   String::from("hello,world")
   "hello,world".to_string()
   
   //String到&str 取切片即可
   fn main() {
       let s = String::from("hello,world!");
       say_hello(&s);
       say_hello(&s[..]);
       say_hello(s.as_str());
   }
   
   fn say_hello(s: &str) {
       println!("{}",s);
   }
   ```

4. 字符串索引（Rust**不支持**）

   ```rust
   let s1 = String::from("hello");
   let hello = String::from("中国人");
   let h = s1[0];
   let h = hello[0];
   //不同字符的编码长度是不一样的，英文是1byte，中文是3byte，对特定单元的索引不一定有意义
   ```

   还有一个原因导致了 Rust 不允许去索引字符串：因为索引操作，我们总是期望它的性能表现是 O(1)，然而对于 `String` 类型来说，无法保证这一点，因为 Rust 可能需要从 0 开始去遍历字符串来定位合法的字符。

   字符串的区间切片Rust是**支持**的，但是必须谨慎

   ```rust
   let hello = "中国人";
   let s = &hello[0..2];
   ```

5. 常见字符串操作

   - 追加和插入

     ```rust
     //追加
     fn main() {
         let mut s = String::from("Hello ");//mut！
     
         s.push_str("rust");//追加字符串
     
         s.push('!');//追加单字符
     }
     
     //插入 insert需要插入位置和内容 位置越界会报错
     fn main() {
         let mut s = String::from("Hello rust!");//mut！
         s.insert(5, ',');
         s.insert_str(6, " I like");
     }
     ```

   - 替换

     ```rust
     //返回一个新的字符串，而不是操作原来的字符串！！！
     //replace  参数是：被替换内容，用来替换的内容
     fn main() {
         let string_replace = String::from("I like rust. Learning rust is my favorite!");
         let new_string_replace = string_replace.replace("rust", "RUST");
     }
     
     //replacen  和前面差不多，不过是替换n个匹配到的
     fn main() {
         let string_replace = "I like rust. Learning rust is my favorite!";
         let new_string_replacen = string_replace.replacen("rust", "RUST", 1);
         dbg!(new_string_replacen);
     }
     
     //方法是直接操作原来的字符串，不会返回新的字符串！！！
     //replace_range  替换特定范围
     fn main() {
         let mut string_replace_range = String::from("I like rust!");//mut！！！
         string_replace_range.replace_range(7..8, "R");
     }
     ```

   - 删除

     ```rust
     //直接操作原来的字符串  mut！！！
     //pop  删除并返回最后一个字符 由于不确保存在，返回的是Option()类型 需要具体考察
     fn main() {
         let mut string_pop = String::from("rust pop 中文!");
         let p1 = string_pop.pop();
         let p2 = string_pop.pop();
     }
     
     //remove 删除指定位置的一个字符  注意给的索引要合法（表示字符的起始位置）
     fn main() {
         let mut string_remove = String::from("测试remove方法");
         println!(
             "string_remove 占 {} 个字节",
             std::mem::size_of_val(string_remove.as_str())
         );
         // 删除第一个汉字
         string_remove.remove(0);
         // 下面代码会发生错误
         // string_remove.remove(1);
         // 直接删除第二个汉字
         // string_remove.remove(3);
         dbg!(string_remove);
     }
     
     //truncate 从当前位置直接删除到结尾 注意给的索引
     fn main() {
         let mut string_truncate = String::from("测试truncate");
         string_truncate.truncate(3);
     }
     
     //clear 清空
     fn main() {
         let mut string_clear = String::from("string clear");
         string_clear.clear();
         dbg!(string_clear);
     }
     ```

   - 连接

     ```rust
     //+或+=   +右边的必须是切片引用类型
     //返回一个新的字符串，所以变量声明可以不需要 mut 关键字修饰
     fn main() {
         let string_append = String::from("hello ");
         let string_rust = String::from("rust");
         // &string_rust会自动解引用为&str
         let result = string_append + &string_rust;
         let mut result = result + "!"; // `result + "!"` 中的 `result` 是不可变的
         result += "!!!";
     
         println!("连接字符串 + -> {}", result);
     }
     
     //format!() 格式化输出
     fn main() {
         let s1 = "hello";
         let s2 = String::from("rust");
         let s = format!("{} {}!", s1, s2);
         println!("{}", s);
     }
     ```

#### 元组

```rust
//模式匹配解构元组
fn main() {
    let tup = (500, 6.4, 1);

    let (x, y, z) = tup;

    println!("The value of y is: {}", y);
}

//用.访问元组
fn main() {
    let x: (i32, f64, u8) = (500, 6.4, 1);

    let five_hundred = x.0;

    let six_point_four = x.1;

    let one = x.2;
}
```

#### 结构体

1. 结构体语法

   ```rust
   //创建
   struct User {
       active: bool,
       username: String,
       email: String,
       sign_in_count: u64,
   }
   
   //初始化  每个字段都要初始化
       let user1 = User {
           email: String::from("someone@example.com"),
           username: String::from("someusername123"),
           active: true,
           sign_in_count: 1,
       };
   
   //通过.来访问结构体内部字段
       let mut user1 = User {  //要改的话还是要mut
           email: String::from("someone@example.com"),
           username: String::from("someusername123"),
           active: true,
           sign_in_count: 1,
       };
   
       user1.email = String::from("anotheremail@example.com");
   
   //当函数参数和结构体字段名称一样时，可以简写
   fn build_user(email: String, username: String) -> User {
       User {
           email,
           username,//缩略的初始化
           active: true,
           sign_in_count: 1,
       }
   }
   
   //更新
     let user2 = User {
           email: String::from("another@example.com"),
           ..user1  //未显式声明的字段都会从user1中获取   不过..user1只可以写在末尾
       };//也就是说你要赋值的写在前面
   
   //更新过程可能会有某些字段发生了所有权的转移，不会影响其他字段的访问
   let user1 = User {
       email: String::from("someone@example.com"),
       username: String::from("someusername123"),
       active: true,
       sign_in_count: 1,
   };
   let user2 = User {
       active: user1.active,
       username: user1.username,
       email: String::from("another@example.com"),
       sign_in_count: user1.sign_in_count,
   };
   println!("{}", user1.active);
   // 下面这行会报错
   println!("{:?}", user1);
   
   ```

2. 元组结构体

   为整个结构体提供名称，而字段不需要

   ```rust
   struct Color(i32, i32, i32);
   struct Point(i32, i32, i32);
   
   let black = Color(0, 0, 0);
   let origin = Point(0, 0, 0);
   ```

3. 单元结构体：没有任何字段和属性的结构体

#### 枚举

1. 任何数据类型都可以放到枚举中

   ```rust
   enum PokerCard {
       Clubs(u8),
       Spades(u8),
       Diamonds(char),//定义枚举成员时关联数据
       Hearts(char),
   }
   
   fn main() {
      let c1 = PokerCard::Spades(5);
      let c2 = PokerCard::Diamonds('A');
   }
   ```

2. 枚举和结构体的对比

   ```rust
   //使用枚举来定义这些消息
   enum Message {
       Quit,
       Move { x: i32, y: i32 },
       Write(String),
       ChangeColor(i32, i32, i32),
   }
   
   fn main() {
       let m1 = Message::Quit;
       let m2 = Message::Move{x:1,y:1};
       let m3 = Message::ChangeColor(255,255,0);
   }
   
   //使用结构体来定义这些消息
   struct QuitMessage; // 单元结构体
   struct MoveMessage {
       x: i32,
       y: i32,
   }
   struct WriteMessage(String); // 元组结构体
   struct ChangeColorMessage(i32, i32, i32); // 元组结构体
   
   //由于每个结构体都有自己的类型，因此我们无法在需要同一类型的地方进行使用，例如某个函数它的功能是接受消息并进行发送，那么用枚举的方式，就可以接收不同的消息，但是用结构体，该函数无法接受 4 个不同的结构体作为参数。
   ```

3. 取代NULL的方式——Option()枚举

   ```rust
   //Option()枚举定义
   enum Option<T> {
       Some(T), //T可以是任何类型
       None,
   }
   
   //示例
   ——————————————
   
   let some_number = Some(5);
   let some_string = Some("a string");
   
   let absent_number: Option<i32> = None;
   //当有个None值时，你需要告诉编译器T的类型，因为编译器无法通过None来推断本来应该是什么
   ```

4. Option()枚举的好处

   ```rust
   let x: i8 = 5;
   let y: Option<i8> = Some(5);
   
   let sum = x + y;//报错！Option(i8)和i8并不是同一种类型
   ```

   当在 Rust 中拥有一个像 `i8` 这样类型的值时，编译器确保它总是有一个有效的值，我们可以放心使用而无需做空值检查。只有当使用 `Option<i8>`（或者任何用到的类型）的时候才需要担心可能没有值，而编译器会确保我们在使用值之前处理了为空的情况。

   换句话说，在对 `Option<T>` 进行 `T` 的运算之前必须将其转换为 `T`。通常这能帮助我们捕获到空值最常见的问题之一：期望某值不为空但实际上为空的情况。

5. match表达式可以用于处理枚举

   ```rust
   fn plus_one(x: Option<i32>) -> Option<i32> {
       match x {
           None => None,
           Some(i) => Some(i + 1),
       }//如果接收到Some(i)类型，将其中的变量绑定到i上，计算i+1，再将其用Some()包裹
   }
   
   let five = Some(5);
   let six = plus_one(five);
   let none = plus_one(None);
   ```

#### 数组

1. 创建

   ```rust
   //RUST的数组是定长的，被存储在栈上
   //变长的动态数组被存储在堆上
   //数组的长度也是类型的一部分
   let a: [i32; 5] = [1, 2, 3, 4, 5];
   
   //声明多个重复值
   let a = [3; 5];
   
   //非基础类型数组的创建
   
   //这样子写会报错，本质还是因为string不能浅拷贝
   let array = [String::from("rust is good!"); 8];
   
   //这样子写可以，但是很难看
   let array = [String::from("rust is good!"),String::from("rust is good!"),String::from("rust is good!")];
   
   //遇到非基本类型数组 调用std::array::from_fn
   let array: [String; 8] = std::array::from_fn(|_i| String::from("rust is good!"));
   ```

2. 支持索引访问，**如果越界会崩溃**

### 流程控制

```rust
fn main() {
    for i in 1..=5 {
        println!("{}", i);
    }
}

//如果想在循环中获取元素的索引，使用.iter()方法获得迭代器
fn main() {
    let a = [4, 3, 2, 1];
    // `.iter()` 方法把 `a` 数组变成一个迭代器
    for (i, v) in a.iter().enumerate() {
        println!("第{}个元素是{}", i + 1, v);
    }
}
```

| 使用方法                      | 等价使用方式                                      | 所有权     |
| ----------------------------- | ------------------------------------------------- | ---------- |
| `for item in collection`      | `for item in IntoIterator::into_iter(collection)` | 转移所有权 |
| `for item in &collection`     | `for item in collection.iter()`                   | 不可变借用 |
| `for item in &mut collection` | `for item in collection.iter_mut()`               | 可变借用   |

```rust
// 第一种
let collection = [1, 2, 3, 4, 5];
for i in 0..collection.len() {
  let item = collection[i];
  // ...
}

// 第二种
for item in collection {

}


//while循环
fn main() {
    let a = [10, 20, 30, 40, 50];
    let mut index = 0;

    while index < 5 {
        println!("the value is: {}", a[index]);

        index = index + 1;
    }
}//用while循环来实现和第一种for循环是一样的
```

第一种方式是循环索引，然后通过索引下标去访问集合，第二种方式是直接循环集合中的元素，优劣如下：

- **性能**：第一种使用方式中 `collection[index]` 的索引访问，会因为边界检查(Bounds Checking)导致运行时的性能损耗 —— Rust 会检查并确认 `index` 是否落在集合内，但是第二种直接迭代的方式就不会触发这种检查，因为编译器会在编译时就完成分析并证明这种访问是合法的
- **安全**：第一种方式里对 `collection` 的索引访问是非连续的，存在一定可能性在两次访问之间，`collection` 发生了变化，导致脏数据产生。而第二种直接迭代的方式是连续访问，因此不存在这种风险( 由于所有权限制，在访问过程中，数据并不会发生变化)。



loop：简单的无限循环，需要搭配break跳出

```rust
fn main() {
    let mut counter = 0;

    let result = loop {
        counter += 1;

        if counter == 10 {
            break counter * 2;//break可以单独使用直接跳出，也可以带一个值返回（类似return）
        }
    };

    println!("The result is {}", result);
}
```



### 模式匹配

#### match和if let

1. 匹配

   ```rust
   enum Coin {
       Penny,
       Nickel,
       Dime,
       Quarter,
   }
   
   fn value_in_cents(coin: Coin) -> u8 {
       match coin {
           Coin::Penny =>  {
               println!("Lucky penny!");
               1
           },
           Coin::Nickel => 5,
           Coin::Dime => 10,
           Coin::Quarter => 25,
       }
   }
   //match匹配需要穷尽所有的可能，用_表示没有列出的其他可能性(如果没有穷尽可能性的话会报错)
   //match的每一个分支都必须是一个表达式,且所有分支的表达式最终返回值的类型必须相同
   ```

2. 模式绑定

   ```rust
   #[derive(Debug)]
   enum UsState {
       Alabama,
       Alaska,
       // --snip--
   }
   
   enum Coin {
       Penny,
       Nickel,
       Dime,
       Quarter(UsState), // 25美分硬币
   }
   
   fn value_in_cents(coin: Coin) -> u8 {
       match coin {
           Coin::Penny => 1,
           Coin::Nickel => 5,
           Coin::Dime => 10,
           Coin::Quarter(state) => {//这里将枚举类别Coin中的UsState值绑定给state变量
               println!("State quarter from {:?}!", state);
               25
           },
       }
   }
   ```

3. if let匹配

   当我们只关注某个特定的值的匹配情况时，可以使用if let匹配代替match

   ```rust
   let v = Some(3u8);
   match v {
       Some(3) => println!("three"),
       _ => (),
   }
   
   //if let匹配
   if let Some(3) = v {
       println!("three");
   }
   ```

4. matches!()宏

   将表达式和模式进行匹配，返回True或者False

   ```rust
   enum MyEnum {
       Foo,
       Bar
   }
   
   fn main() {
       let v = vec![MyEnum::Foo,MyEnum::Bar,MyEnum::Foo];
   }
   //对v进行过滤，只保留类型为MyEnum::Foo的元素
   v.iter().filter(|x| matches!(x, MyEnum::Foo));
   
   //更多例子
   let foo = 'f';
   assert!(matches!(foo, 'A'..='Z' | 'a'..='z'));
   
   let bar = Some(4);
   assert!(matches!(bar, Some(x) if x > 2));
   ```

5. match和if let匹配导致的变量遮蔽

   ​	尽量不要使用同名变量

   ```rust
   fn main() {
      let age = Some(30);
      println!("在匹配前，age是{:?}",age);
      if let Some(age) = age {
          println!("匹配出来的age是{}",age);
      }
   
      println!("在匹配后，age是{:?}",age);
   }
   
   fn main() {
      let age = Some(30);
      println!("在匹配前，age是{:?}",age);
      match age {
          Some(age) =>  println!("匹配出来的age是{}",age),
          _ => ()
      }
      println!("在匹配后，age是{:?}",age);
   }
   ```

#### 一些模式适用场景

1. while let 只要匹配就会一直循环下去

   ```rust
   // Vec是动态数组
   let mut stack = Vec::new();
   
   // 向数组尾部插入元素
   stack.push(1);
   stack.push(2);
   stack.push(3);
   
   // stack.pop从数组尾部弹出元素
   while let Some(top) = stack.pop() {
       println!("{}", top);
   }
   ```

2. let和if let

   ```rust
   let Some(x) = some_option_value;//报错，有可能是None
   //let，match，for都需要完全匹配(不可驳匹配)
   
   if let Some(x) = some_option_value {
       println!("{}", x);
   }//通过，只要有值的情况，其余情况忽略(可驳模式匹配)
   ```

#### 全模式列表

1. 用序列语法`..=`匹配区间内的值（还是只能用于数字和字符）

   ```rust
   let x = 5;
   
   match x {
       1..=5 => println!("one through five"),
       _ => println!("something else"),
   }
   
   ```

2. 使用模式忽略值

   ```rust
   //忽略函数变量
   fn foo(_: i32, y: i32) {
       println!("This code only uses the y parameter: {}", y);
   }
   
   fn main() {
       foo(3, 4);
   }
   ```

   用`_`忽略值和用`_s`的区别

   ```rust
   let s = Some(String::from("Hello!"));
   
   if let Some(_s) = s {
       println!("found a string");
   }
   
   println!("{:?}", s);//会报错，因为s的所有权已经转移给_s了
   
   ——————————————————————————
   
   let s = Some(String::from("Hello!"));
   
   if let Some(_) = s {
       println!("found a string");
   }
   
   println!("{:?}", s);//使用下划线本身是不会绑定值的
   ```

3. 使用`..`忽略多个值需要保证没有歧义

   ```rust
   fn main() {
       let numbers = (2, 4, 8, 16, 32);
   
       match numbers {
           (.., second, ..) => {
               println!("Some numbers: {}", second)
           },
       }
   }//报错，编译器无法理解second具体指哪个
   ```

4. 匹配守卫——为匹配提供额外条件

   ```rust
   fn main() {
       let x = Some(5);
       let y = 10;
   
       match x {
           Some(50) => println!("Got 50"),
           Some(n) if n == y => println!("Matched, n = {}", n),
           //通过匹配守卫，使得在匹配中也可以正常的使用外部变量，而不用担心变量遮蔽的问题
           _ => println!("Default case, x = {:?}", x),
       }
   
       println!("at the end: x = {:?}, y = {}", x, y);
   }
   
   ——————————————————
   //匹配守卫的优先级：会作用于所有的匹配项
   let x = 4;
   let y = false;
   
   match x {
       4 | 5 | 6 if y => println!("yes"),
       _ => println!("no"),
   }
   
   ```

5. @绑定——提供在限定范围条件下，在分支代码内部使用变量的能力

   ```rust
   enum Message {
       Hello { id: i32 },
   }
   
   let msg = Message::Hello { id: 5 };
   
   match msg {
       Message::Hello { id: id_variable @ 3..=7 } => {
           println!("Found an id in range: {}", id_variable)
       },//@变量绑定，限定范围且绑定变量
       Message::Hello { id: 10..=12 } => {
           println!("Found an id in another range")
       },//限定了范围，但是这样子只会匹配，而id这个量用不了
       Message::Hello { id } => {
           println!("Found some other id: {}", id)
       },//可以匹配并绑定到id上，但是这样子限制不了范围
   }
   
   
   ————————————————
   //绑定的同时对变量结构
   #[derive(Debug)]
   struct Point {
       x: i32,
       y: i32,
   }
   
   fn main() {
       // 绑定新变量 `p`，同时对 `Point` 进行解构
       let p @ Point {x: px, y: py } = Point {x: 10, y: 23};
       println!("x: {}, y: {}", px, py);
       println!("{:?}", p);
   
       let point = Point {x: 10, y: 5};
       if let p @ Point {x: 10, y} = point {
           println!("x is 10 and y is {} in {:?}", y, p);
       } else {
           println!("x was not 10 :(");
       }
   }
   ```

   

### 方法Method

1. 定义和初始化

   ```rust
   struct Circle {
       x: f64,
       y: f64,
       radius: f64,
   }
   
   impl Circle {
       // new是Circle的关联函数，因为它的第一个参数不是self，且new并不是关键字
       // 这种方法往往用于初始化当前结构体的实例
       fn new(x: f64, y: f64, radius: f64) -> Circle {
           Circle {
               x: x,
               y: y,
               radius: radius,
           }
       }
   
       // Circle的方法，&self表示借用当前的Circle结构体
       fn area(&self) -> f64 {
           std::f64::consts::PI * (self.radius * self.radius)
       }
   }
   ```

   ​	这种定义在 `impl` 中且没有 `self` 的函数被称之为**关联函数**： 因为它没有 `self`，不能用 `f.read()` 的形式调用，因此它是一个函数而不是方法，它又在 `impl` 中，与结构体紧密关联，因此称为关联函数。

   ​	因为是函数，所以不能用 `.` 的方式来调用，我们需要用 `::` 来调用，例如 `let sq = Rectangle::new(3, 3);`。这个方法位于结构体的命名空间中：`::` 语法用于关联函数和模块创建的命名空间。

   {% asset_img D:\116\sigs\blog\source\_posts\Rust语言初步以及Rustlings错题整理 method.png%}

   其他的语言往往将类型和方法一起定义，而Rust对这两者的定义是分开的。

2. self和被实例化类型的关系

   ```rust
   #[derive(Debug)]
   struct Rectangle {
       width: u32,
       height: u32,
   }
   
   impl Rectangle {//方法名称可以和结构体的名称相同
       fn area(&self) -> u32 {
           self.width * self.height
       }
       //self 表示 Rectangle 的所有权转移到该方法中，这种形式用的较少
       //&self 表示该方法对 Rectangle 的不可变借用
       //&mut self 表示可变借用
   
   }
   
   fn main() {
       let rect1 = Rectangle { width: 30, height: 50 };
   
       println!(
           "The area of the rectangle is {} square pixels.",
           rect1.area()
       );
   }
   ```

3. 方法和字段同名的好处

   ```rust
   pub struct Rectangle {
       width: u32,
       height: u32,
   }
   
   impl Rectangle {
       pub fn new(width: u32, height: u32) -> Self {
           Rectangle { width, height }
       }
       pub fn width(&self) -> u32 {
           return self.width;
       }
   }
   
   fn main() {
       let rect1 = Rectangle::new(30, 50);
   
       println!("{}", rect1.width());
   }
   ```

   ​	方法和字段同名有助于我们实现访问器，我们可以将`width`和`height`设置为私有属性，而通过`pub`关键字将`Rectangle`结构体对应的`new`方法和`width`方法设置为公有方法，这样子用户可以通过`rect1.width()`方法访问到宽度的数据，却无法直接使用`rect1.width`来访问。

4. Rust中用自动引用/解引用机制代替了C/C++的->运算符

   ​	在 C/C++ 语言中，有两个不同的运算符来调用方法：`.` 直接在对象上调用方法，而 `->` 在一个对象的指针上调用方法，这时需要先解引用指针。换句话说，如果 `object` 是一个指针，那么 `object->something()` 和 `(*object).something()` 是一样的。

   ​	Rust 并没有一个与 `->` 等效的运算符；相反，Rust 有一个叫 **自动引用和解引用**的功能。方法调用是 Rust 中少数几个拥有这种行为的地方。

   ​	他是这样工作的：当使用 `object.something()` 调用方法时，Rust 会自动为 `object` 添加 `&`、`&mut` 或 `*` 以便使 `object` 与方法签名匹配。也就是说，这些代码是等价的：

   ```rust
   p1.distance(&p2);
   (&p1).distance(&p2);
   ```

   ​	第一行看起来简洁的多。这种自动引用的行为之所以有效，是因为方法有一个明确的接收者———— `self` 的类型。在给出接收者和方法名的前提下，Rust 可以明确地计算出方法是仅仅读取（`&self`），做出修改（`&mut self`）或者是获取所有权（`self`）。事实上，Rust 对方法接收者的隐式借用让所有权在实践中更友好。

### 泛型和特征

#### 泛型

1. 代替值的泛型，而不是针对类型的泛型

   ```rust
   //这段代码会报错，因为不同长度的数组在Rust中是不同的类型
   fn display_array(arr: [i32; 3]) {
       println!("{:?}", arr);
   }
   fn main() {
       let arr: [i32; 3] = [1, 2, 3];
       display_array(arr);
   
       let arr: [i32; 2] = [1, 2];
       display_array(arr);
   }
   
   //用切片的方式打印任意长度的数组，同时用泛型指代不同的类型
   fn display_array<T: std::fmt::Debug>(arr: &[T]) {
       println!("{:?}", arr);
   }
   fn main() {
       let arr: [i32; 3] = [1, 2, 3];
       display_array(&arr);
   
       let arr: [i32; 2] = [1, 2];
       display_array(&arr);
   }
   
   //切片是一种引用，但是有的场景不允许我们使用引用，此时通过const泛型指代不同的长度
   fn display_array<T: std::fmt::Debug, const N: usize>(arr: [T; N]) {
       println!("{:?}", arr);
   }
   fn main() {
       let arr: [i32; 3] = [1, 2, 3];
       display_array(arr);
   
       let arr: [i32; 2] = [1, 2];
       display_array(arr);
   }
   ```

2. 泛型的性能

   编译器完成**单态化**的过程，增加了编译的繁琐程度，也让编译后的文件更大

   会对每一个具体用到的类型都生成一份代码

   ```rust
   //程序编写
   let integer = Some(5);
   let float = Some(5.0);
   
   //编译后
   enum Option_i32 {
       Some(i32),
       None,
   }
   
   enum Option_f64 {
       Some(f64),
       None,
   }
   
   fn main() {
       let integer = Option_i32::Some(5);
       let float = Option_f64::Some(5.0);
   }
   ```

#### 特征

​	一组可以被共享的行为，只要满足了特征，就可以做以下的行为。

1. 定义特征

   ​	只管定义，而往往不会提供具体的实现

   ​	谁满足这个特征，谁来实现具体的方法

   ```rust
   pub trait Summary {
       fn summarize(&self) -> String;//以;结尾 只提供定义
   }
   
   pub trait Summary {
       fn summarize(&self) -> String { //也可以给一个默认实现
           String::from("(Read more...)")
       }//可以调用，也可以重载
   }
   ```

   ​	**默认实现允许调用相同特征中的其他方法，哪怕这些方法没有默认实现。**如此，特征可以提供很多有用的功能而只需要实现指定的一小部分内容。例如，我们可以定义 `Summary` 特征，使其具有一个需要实现的 `summarize_author` 方法，然后定义一个 `summarize` 方法，此方法的默认实现调用 `summarize_author` 方法：

   ```rust
   pub trait Summary {
       fn summarize_author(&self) -> String;//让实现Summary特征的类型具体实现吧
   
       fn summarize(&self) -> String {
           format!("(Read more from {}...)", self.summarize_author())
       }
   }
   ```

2. 实现特征

   ```rust
   pub trait Summary {
       fn summarize(&self) -> String;
   }
   pub struct Post {
       pub title: String, // 标题
       pub author: String, // 作者
       pub content: String, // 内容
   }
   
   impl Summary for Post {//为Post实现Summary特征
       fn summarize(&self) -> String {
           format!("文章{}, 作者是{}", self.title, self.author)
       }
   }
   
   pub struct Weibo {
       pub username: String,
       pub content: String
   }
   
   impl Summary for Weibo {
       fn summarize(&self) -> String {
           format!("{}发表了微博{}", self.username, self.content)
       }
   }
   ```

3. 孤儿规则——特征定义和实现的位置关系

   ​	关于特征实现与定义的位置，有一条非常重要的原则：**如果你想要为类型** `A` **实现特征** `T`**，那么** `A` **或者** `T` **至少有一个是在当前作用域中定义的！** 例如我们可以为上面的 `Post` 类型实现标准库中的 `Display` 特征，这是因为 `Post` 类型定义在当前的作用域中。同时，我们也可以在当前包中为 `String` 类型实现 `Summary` 特征，因为 `Summary` 定义在当前作用域中。

   ​	但是你无法在当前作用域中，为 `String` 类型实现 `Display` 特征，因为它们俩都定义在标准库中，其定义所在的位置都不在当前作用域，跟你半毛钱关系都没有，看看就行了。

4. 使用特征作为函数的参数

   ```rust
   pub fn notify(item: &impl Summary) {//实现了特征Summary的item参数
       println!("Breaking news! {}", item.summarize());//可以调用特征对应的方法
   }
   ```

5. 特征约束

   ```rust
   //接收两个实现了Summary特征的参数，但是不能保证这两个参数的类型相同
   pub fn notify(item1: &impl Summary, item2: &impl Summary) {}
   
   //用泛型T指代
   //T:Summary要求其实现了特征Summary
   pub fn notify<T: Summary>(item1: &T, item2: &T) {}
   
   //多重约束
   //这里T被要求同时实现两个特征才行
   pub fn notify<T: Summary + Display>(item: &T) {}
   
   //Where约束，主要是用于简化函数的签名，将特征约束写在别处
   fn some_function<T, U>(t: &T, u: &U) -> i32
       where T: Display + Clone,
             U: Clone + Debug
   {}
   ```

6. 函数返回值中的impl Trait

   ```rust
   fn returns_summarizable() -> impl Summary {
       //返回一个实现了Summary特征的类型，具体是什么类型不知道
       Weibo {
           username: String::from("sunface"),
           content: String::from(
               "m1 max太厉害了，电脑再也不会卡",
           )
       }
   }
   ```

   ​	这种 `impl Trait` 形式的返回值，在一种场景下非常非常有用，那就是返回的真实类型非常复杂，你不知道该怎么声明时(毕竟 Rust 要求你必须标出所有的类型)，此时就可以用 `impl Trait` 的方式简单返回。

7. derive派生特征

   ​	在本书中，形如 `#[derive(Debug)]` 的代码已经出现了很多次，这种是一种特征派生语法，被 `derive` 标记的对象会自动实现对应的默认特征代码，继承相应的功能。

   ​	例如 `Debug` 特征，它有一套自动实现的默认代码，当你给一个结构体标记后，就可以使用 `println!("{:?}", s)` 的形式打印该结构体的对象。

   ​	再如 `Copy` 特征，它也有一套自动实现的默认代码，当标记到一个类型上时，可以让这个类型自动实现 `Copy` 特征，进而可以调用 `copy` 方法，进行自我复制。

   ​	总之，`derive` 派生出来的是 Rust 默认给我们提供的特征，在开发过程中极大的简化了自己手动实现相应特征的需求，当然，如果你有特殊的需求，还可以自己手动重载该实现。

#### 特征对象

​	指向了所有实现了某特征的对象，二者之间存在映射关系，可以通过特征对象找到该对象具体的实现方法。

1. 可以通过 `&` 引用或者 `Box<T>` 智能指针的方式来创建特征对象

   ```rust
   trait Draw {
       fn draw(&self) -> String;
   }
   
   impl Draw for u8 {
       fn draw(&self) -> String {
           format!("u8: {}", *self)
       }
   }
   
   impl Draw for f64 {
       fn draw(&self) -> String {
           format!("f64: {}", *self)
       }
   }
   
   // 若 T 实现了 Draw 特征， 则调用该函数时传入的 Box<T> 可以被隐式转换成函数参数签名中的 Box<dyn Draw>
   fn draw1(x: Box<dyn Draw>) {
       // 由于实现了 Deref 特征，Box 智能指针会自动解引用为它所包裹的值，然后调用该值对应的类型上定义的 `draw` 方法
       x.draw();
   }
   
   fn draw2(x: &dyn Draw) {
       x.draw();
   }
   
   fn main() {
       let x = 1.1f64;
       // do_something(&x);
       let y = 8u8;
   
       // x 和 y 的类型 T 都实现了 `Draw` 特征，因为 Box<T> 可以在函数调用时隐式地被转换为特征对象 Box<dyn Draw> 
       // 基于 x 的值创建一个 Box<f64> 类型的智能指针，指针指向的数据被放置在了堆上
       draw1(Box::new(x));
       // 基于 y 的值创建一个 Box<u8> 类型的智能指针
       draw1(Box::new(y));
       draw2(&x);
       draw2(&y);
   }
   ```

   - `draw1` 函数的参数是 `Box<dyn Draw>` 形式的特征对象，该特征对象是通过 `Box::new(x)` 的方式创建的
   - `draw2` 函数的参数是 `&dyn Draw` 形式的特征对象，该特征对象是通过 `&x` 的方式创建的
   - `dyn` 关键字只用在特征对象的类型声明上，在创建时无需使用 `dyn`

   可以通过特征对象来代表具体的泛型。

2. 使用泛型的实现和特征对象的对比

   ```rust
   pub struct Screen<T: Draw> {
       pub components: Vec<T>,
   }
   
   impl<T> Screen<T>
       where T: Draw {
       pub fn run(&self) {
           for component in self.components.iter() {
               component.draw();
           }
       }
   }
   
   ```

   ​	上面的 `Screen` 的列表中，存储了类型为 `T` 的元素，然后在 `Screen` 中使用特征约束让 `T` 实现了 `Draw` 特征，进而可以调用 `draw` 方法。

   ​	但是这种写法限制了 `Screen` 实例的 `Vec<T>` 中的每个元素必须是 `Button` 类型或者全是 `SelectBox` 类型。如果只需要同质（相同类型）集合，更倾向于采用泛型+特征约束这种写法，因其实现更清晰，且性能更好(特征对象，需要在运行时从 `vtable` 动态查找需要调用的方法)。

3. 特征对象的限制

   **不是所有特征都能拥有特征对象，只有对象安全的特征才行。**当一个特征的所有方法都有如下属性时，它的对象才是安全的：

   - 方法的返回类型不能是 `Self`
   - 方法没有任何泛型参数

   对象安全对于特征对象是必须的，因为一旦有了特征对象，就不再需要知道实现该特征的具体类型是什么了。如果特征方法返回了具体的 `Self` 类型，但是特征对象忘记了其真正的类型，那这个 `Self` 就非常尴尬，因为没人知道它是谁了。但是对于泛型类型参数来说，当使用特征时其会放入具体的类型参数：此具体类型变成了实现该特征的类型的一部分。而当使用特征对象时其具体类型被抹去了，故而无从得知放入泛型参数类型到底是什么。

   标准库中的 `Clone` 特征就不符合对象安全的要求：

   ```rust
   pub trait Clone {
       fn clone(&self) -> Self;
   }
   ```

   因为它的其中一个方法，返回了 `Self` 类型，因此它是对象不安全的。

4. 特征对象的动态分发

   ​	静态分发：编译器会为每一个泛型参数对应的具体类型生成一份代码

   ​	动态分发：直到运行时，才能确定需要调用什么方法。编译器无法知晓所有可能用于特征对象代码的类型，所以它也不知道应该调用哪个类型的哪个方法实现。

   ![img](D:\116\sigs\blog\source\_posts\Rust语言初步以及Rustlings错题整理.assets\v2-b771fe4cfc6ebd63d9aff42840eb8e67_1440w.jpg)

   ​	

   - **特征对象大小不固定**：这是因为，对于特征 `Draw`，类型 `Button` 可以实现特征 `Draw`，类型 `SelectBox` 也可以实现特征 `Draw`，因此特征没有固定大小
   - 几乎总是使用特征对象的引用方式，如`&dyn Draw`和`Box<dyn Draw>`
     - 虽然特征对象没有固定大小，但它的引用类型的大小是固定的，它由两个指针组成（`ptr` 和 `vptr`），因此占用两个指针大小
     - 一个指针 `ptr` 指向实现了特征 `Draw` 的具体类型的实例，也就是当作特征 `Draw` 来用的类型的实例，比如类型 `Button` 的实例、类型 `SelectBox` 的实例
     - 另一个指针 `vptr` 指向一个虚表 `vtable`，`vtable` 中保存了类型 `Button` 或类型 `SelectBox` 的实例对于可以调用的实现于特征 `Draw` 的方法。当调用方法时，直接从 `vtable` 中找到方法并调用。之所以要使用一个 `vtable` 来保存各实例的方法，是因为实现了特征 `Draw` 的类型有多种，这些类型拥有的方法各不相同，当将这些类型的实例都当作特征 `Draw` 来使用时(此时，它们全都看作是特征 `Draw` 类型的实例)，有必要区分这些实例各自有哪些方法可调用

   简而言之，当类型 `Button` 实现了特征 `Draw` 时，类型 `Button` 的实例对象 `btn` 可以当作特征 `Draw` 的特征对象类型来使用，`btn` 中保存了作为特征对象的数据指针（指向类型 `Button` 的实例数据）和行为指针（指向 `vtable`）。

   一定要注意，此时的 `btn` 是 `Draw` 的特征对象的实例，而不再是具体类型 `Button` 的实例，而且 `btn` 的 `vtable` 只包含了实现自特征 `Draw` 的那些方法（比如 `draw`），因此 `btn` 只能调用实现于特征 `Draw` 的 `draw` 方法，而不能调用类型 `Button` 本身实现的方法和类型 `Button` 实现于其他特征的方法。**也就是说，`btn` 是哪个特征对象的实例，它的 `vtable` 中就包含了该特征的方法。**

#### 特征进阶内容

1. 关联类型

   在特征定义的语句块中，声明一个自定义类型，这样就可以在特征中使用这个类型。

   ```rust
   pub trait Iterator {
       type Item;
   
       fn next(&mut self) -> Option<Self::Item>;
   }
   ```





## Rustlings习题整理

### map()的用法

```rust
fn vec_map(v: &Vec<i32>) -> Vec<i32> {
    v.iter().map(|element| {
        // TODO: Do the same thing as above - but instead of mutating the
        // Vec, you can just return the new number!
        *element * 2
    }).collect()
}
//map方法由原来的迭代器生成一个新的迭代器，对旧迭代器的每一个方法都调用该闭包
```

### 字符串和切片操作

```rust
fn trim_me(input: &str) -> String {
    // TODO: Remove whitespace from both ends of a string!
    input.trim().to_string()
}

fn compose_me(input: &str) -> String {
    // TODO: Add " world!" to the string! There's multiple ways to do this!
    input.to_string() + " world!"
}

fn replace_me(input: &str) -> String {
    // TODO: Replace "cars" in the string with "balloons"!
    input.replace("cars","balloons").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trim_a_string() {
        assert_eq!(trim_me("Hello!     "), "Hello!");
        assert_eq!(trim_me("  What's up!"), "What's up!");
        assert_eq!(trim_me("   Hola!  "), "Hola!");
    }

    #[test]
    fn compose_a_string() {
        assert_eq!(compose_me("Hello"), "Hello world!");
        assert_eq!(compose_me("Goodbye"), "Goodbye world!");
    }

    #[test]
    fn replace_a_string() {
        assert_eq!(replace_me("I think cars are cool"), "I think balloons are cool");
        assert_eq!(replace_me("I love to look at cars"), "I love to look at balloons");
    }
}
```

### 判断字符串和字符串切片的类型

```rust
fn string_slice(arg: &str) {
    println!("{}", arg);
}
fn string(arg: String) {
    println!("{}", arg);
}

fn main() {
    string_slice("blue");
    string("red".to_string());
    string(String::from("hi"));
    string("rust is fun!".to_owned()); 
    //to_owned()方法用于从借用的数据中创建一个具有所有权的副本
    //和clone方法的区别是如果传入的参数是引用类型的，可以通过复制获得其所有权
    string_slice("nice weather".into()); 
    string(format!("Interpolation {}", "Station"));
    string_slice(&String::from("abc")[0..1]);
    string_slice("  hello there ".trim());
    string("Happy Monday!".to_string().replace("Mon", "Tues"));
    string("mY sHiFt KeY iS sTiCkY".to_lowercase()); 
    //to_lowercase()返回此字符串切片的小写等效项，类型为string
}
```

|      | clone()  | to_owned() |
| ---- | -------- | ---------- |
| T    | T -> T   | T -> T     |
| &T   | &T -> &T | &T -> T    |

### 模块use

```rust
mod delicious_snacks {
    // TODO: Fix these use statements
    pub use self::fruits::PEAR as fruit;//修改为pub才对外可见
    pub use self::veggies::CUCUMBER as veggie;

    mod fruits {
        pub const PEAR: &'static str = "Pear";
        pub const APPLE: &'static str = "Apple";
    }

    mod veggies {
        pub const CUCUMBER: &'static str = "Cucumber";
        pub const CARROT: &'static str = "Carrot";
    }
}

fn main() {
    println!(
        "favorite snacks: {} and {}",
        delicious_snacks::fruit,
        delicious_snacks::veggie
    );
}
```

### 比赛统计

```rust
use std::collections::HashMap;

// A structure to store the goal details of a team.
struct Team {
    goals_scored: u8,
    goals_conceded: u8,
}

fn build_scores_table(results: String) -> HashMap<String, Team> {
    // The name of the team is the key and its associated struct is the value.
    let mut scores: HashMap<String, Team> = HashMap::new();

    for r in results.lines() {
        let v: Vec<&str> = r.split(',').collect();
        let team_1_name = v[0].to_string();
        let team_1_score: u8 = v[2].parse().unwrap();
        let team_2_name = v[1].to_string();
        let team_2_score: u8 = v[3].parse().unwrap();
        //注意Team是没有实现可加性的，只可以按照Team内部的元素来操作
        let team1 = scores.entry(team_1_name).or_insert(Team{
            goals_scored:0,
            goals_conceded:0
        });
        team1.goals_scored += team_1_score;
        team1.goals_conceded += team_2_score;
        
        let team2 = scores.entry(team_2_name).or_insert(Team{
            goals_scored:0,
            goals_conceded:0
        });
        team2.goals_scored += team_2_score;
        team2.goals_conceded += team_1_score;
    }
    scores
}

#[cfg(test)]
mod tests {
    use super::*;

    fn get_results() -> String {
        let results = "".to_string()
            + "England,France,4,2\n"
            + "France,Italy,3,1\n"
            + "Poland,Spain,2,0\n"
            + "Germany,England,2,1\n";
        results
    }

    #[test]
    fn build_scores() {
        let scores = build_scores_table(get_results());

        let mut keys: Vec<&String> = scores.keys().collect();
        keys.sort();
        assert_eq!(
            keys,
            vec!["England", "France", "Germany", "Italy", "Poland", "Spain"]
        );
    }

    #[test]
    fn validate_team_score_1() {
        let scores = build_scores_table(get_results());
        let team = scores.get("England").unwrap();
        assert_eq!(team.goals_scored, 5);
        assert_eq!(team.goals_conceded, 4);
    }

    #[test]
    fn validate_team_score_2() {
        let scores = build_scores_table(get_results());
        let team = scores.get("Spain").unwrap();
        assert_eq!(team.goals_scored, 0);
        assert_eq!(team.goals_conceded, 2);
    }
}
```

### **quiz2**

首先要观察代码判断其类型，随后用match表达式匹配枚举类型，做出相应的处理

```rust
pub enum Command {
    Uppercase,
    Trim,
    Append(usize),
}

mod my_module {
    use super::Command;

    // TODO: Complete the function signature!
    pub fn transformer(input: Vec<(String,Command)>) -> Vec<String> {
        // TODO: Complete the output declaration!
        let mut output: Vec<String> = vec![];
        for (string, command) in input.iter() {
            // TODO: Complete the function body. You can do it!
            let applied_string:String = match command{
                Command::Uppercase => string.to_uppercase(),
                Command::Trim => string.trim().to_string(),
                Command::Append(n) => format!("{}{}",string,"bar".repeat(*n)),
            };
            output.push(applied_string);
        }
        output
    }
}

#[cfg(test)]
mod tests {
    // TODO: What do we need to import to have `transformer` in scope?
    use crate::my_module::transformer;
    use super::Command;

    #[test]
    fn it_works() {
        let output = transformer(vec![
            ("hello".into(), Command::Uppercase),
            (" all roads lead to rome! ".into(), Command::Trim),
            ("foo".into(), Command::Append(1)),
            ("bar".into(), Command::Append(5)),
        ]);
        assert_eq!(output[0], "HELLO");
        assert_eq!(output[1], "all roads lead to rome!");
        assert_eq!(output[2], "foobar");
        assert_eq!(output[3], "barbarbarbarbarbar");
    }
}

```

### 从Option中取出值

```rust
//如果你确定Option中是有值的，可以使用unwrap()方法直接取出来
let my_option: Option<i32> = Some(5); // 一个Option<i32>类型的变量

let value = my_option.unwrap();
println!("The value is: {}", value);

//如果要处理可能有None的情况，可以使用unwrap_or(初始值)
//为None的情况设置一个初始值
let my_option: Option<i32> = Some(5); // 一个Option<i32>类型的变量

let value = my_option.unwrap_or(0); // 如果my_option是None，则使用默认值0
println!("The value is: {}", value);

```

### Option的类型问题

```rust
let range = 10;
let mut optional_integers: Vec<Option<i8>> = vec![None];

for i in 1..(range + 1) {
    optional_integers.push(Some(i));
}

let mut cursor = range;

//pop()函数会包着一层Some()在外面
while let Some(Some(integer)) = optional_integers.pop() {
    assert_eq!(integer, cursor);
    cursor -= 1;
}
```

### 所有权的问题

```rust
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let y: Option<Point> = Some(Point { x: 100, y: 200 });

    match y {
        Some(ref p) => println!("Co-ordinates are {},{} ", p.x, p.y),
        //加ref是为了防止所有权的转移
        _ => panic!("no match!"),
    }
    y; // Fix without deleting this line.
}
```

### ? 表达式

```rust
impl ParsePosNonzeroError {
    fn from_creation(err: CreationError) -> ParsePosNonzeroError {
        ParsePosNonzeroError::Creation(err)
    }
    // TODO: add another error conversion function here.
    fn from_parseint(err: ParseIntError) -> ParsePosNonzeroError{
        ParsePosNonzeroError::ParseInt(err)
    }
}

fn parse_pos_nonzero(s: &str) -> Result<PositiveNonzeroInteger, ParsePosNonzeroError> {
    // TODO: change this to return an appropriate error instead of panicking
    // when `parse()` returns an error.
    let x: i64 = s.parse().map_err(ParsePosNonzeroError::from_parseint)?;
    PositiveNonzeroInteger::new(x).map_err(ParsePosNonzeroError::from_creation)
}
```

### 为动态数组Vector实现特征

```rust
trait AppendBar {
    fn append_bar(self) -> Self;
}

// TODO: Implement trait `AppendBar` for a vector of strings.
impl AppendBar for Vec<String>{
    fn append_bar(mut self) -> Self{ //声明可变mut
        self.push("Bar".to_string());
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_vec_pop_eq_bar() {
        let mut foo = vec![String::from("Foo")].append_bar();
        assert_eq!(foo.pop().unwrap(), String::from("Bar"));
        assert_eq!(foo.pop().unwrap(), String::from("Foo"));
    }
}
```

### 特征约束代替类型

```rust
pub trait Licensed {
    fn licensing_info(&self) -> String {
        "some information".to_string()
    }
}

struct SomeSoftware {}

struct OtherSoftware {}

impl Licensed for SomeSoftware {}
impl Licensed for OtherSoftware {}

// YOU MAY ONLY CHANGE THE NEXT LINE
fn compare_license_types(software:impl Licensed, software_two:impl Licensed) -> bool {
    software.licensing_info() == software_two.licensing_info()
}
//下面有SomeSoftware和OtherSoftware两种类型
//用impl Licensed可以指代他们

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compare_license_information() {
        let some_software = SomeSoftware {};
        let other_software = OtherSoftware {};

        assert!(compare_license_types(some_software, other_software));
    }

    #[test]
    fn compare_license_information_backwards() {
        let some_software = SomeSoftware {};
        let other_software = OtherSoftware {};

        assert!(compare_license_types(other_software, some_software));
    }
}
```

### #[should_panic]

```rust
struct Rectangle {
    width: i32,
    height: i32
}

impl Rectangle {
    // Only change the test functions themselves
    pub fn new(width: i32, height: i32) -> Self {
        if width <= 0 || height <= 0 {
            panic!("Rectangle width and height cannot be negative!")
        }
        Rectangle {width, height}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn correct_width_and_height() {
        // This test should check if the rectangle is the size that we pass into its constructor
        let rect = Rectangle::new(10, 20);
        assert_eq!(rect.width, 10); // check width
        assert_eq!(rect.height, 20); // check height
    }

    #[test]
    #[should_panic]
    fn negative_width() {
        // This test should check if program panics when we try to create rectangle with negative width
        let _rect = Rectangle::new(-10, 10);

    }

    #[test]
    #[should_panic]
    fn negative_height() {
        // This test should check if program panics when we try to create rectangle with negative height
        let _rect = Rectangle::new(10, -10);
    }
}
```

### 迭代器方法

```rust
pub fn capitalize_first(input: &str) -> String {
    let mut c = input.chars();
    match c.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().to_string() + c.as_str(),
    }
}

// Step 2.
// Apply the `capitalize_first` function to a slice of string slices.
// Return a vector of strings.
// ["hello", "world"] -> ["Hello", "World"]
pub fn capitalize_words_vector(words: &[&str]) -> Vec<String> {
    words.iter().map(
        |&word| {
            capitalize_first(word)
        }
    ).collect()
}

// Step 3.
// Apply the `capitalize_first` function again to a slice of string slices.
// Return a single string.
// ["hello", " ", "world"] -> "Hello World"
pub fn capitalize_words_string(words: &[&str]) -> String {
    words.iter().map(
        |&word| {
            capitalize_first(word)
        }
    ).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_success() {
        assert_eq!(capitalize_first("hello"), "Hello");
    }

    #[test]
    fn test_empty() {
        assert_eq!(capitalize_first(""), "");
    }

    #[test]
    fn test_iterate_string_vec() {
        let words = vec!["hello", "world"];
        assert_eq!(capitalize_words_vector(&words), ["Hello", "World"]);
    }

    #[test]
    fn test_iterate_into_string() {
        let words = vec!["hello", " ", "world"];
        assert_eq!(capitalize_words_string(&words), "Hello World");
    }
}
```

### 宏

```rust
//宏的定义要在使用之前
macro_rules! my_macro {
    () => {
        println!("Check out my macro!");
    };
}

fn main() {
    my_macro!();
}

//使用分号区分不同的模式
#[rustfmt::skip]
macro_rules! my_macro {
    () => {
        println!("Check out my macro!");
    }; //使用分号来区分不同的模式
    ($val:expr) => {
        println!("Look at this other macro: {}", $val);
    }
}

fn main() {
    my_macro!();
    my_macro!(7777);
}
```

