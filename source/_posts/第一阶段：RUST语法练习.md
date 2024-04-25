---
title: 第一阶段：RUST语法练习
date: 2024-04-24 17:59:12
tags:
  - author: Easter1995
---
# 第一阶段：RUST语法练习

# variables6.rs

关于const：

Rust的常量必须加类型。那为什么常量不推导呢？ 这是因为故意这样设计的，指定类型就不会因为自动推导类型出问题。

[常量 - 通过例子学 Rust 中文版](https://rustwiki.org/zh-CN/rust-by-example/custom_types/constants.html)

[static, const, let 声明变量有什么区别？ - Rust语言中文社区](https://rustcc.cn/article?id=d3954670-a58a-427d-9c0c-6666051f5cc7#:~:text=const%20%E4%B8%8E%20let%20%E9%83%BD%E6%98%AF%E2%80%9C%E6%9C%89%E9%99%90%E7%94%9F%E5%91%BD%E2%80%9D%EF%BC%8C%E8%B6%85%E5%87%BA%E4%BA%86%E4%BD%9C%E7%94%A8%E5%9F%9F%E9%83%BD%E5%BE%97%E8%A2%AB%E9%87%8A%E6%94%BE%E3%80%82%20%E8%8B%A5%E5%AE%9E%E7%8E%B0%E4%BA%86%20Drop%20trait%20%EF%BC%8C%E5%AE%83%E7%9A%84,static%20%E4%B8%8E%20const%20%E9%83%BD%E8%A6%81%E6%B1%82%20Rustacean%20%E6%98%BE%E7%A4%BA%E5%9C%B0%E6%A0%87%E6%B3%A8%E5%8F%98%E9%87%8F%E7%9A%84%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B%EF%BC%8C%E4%B8%8D%E6%94%AF%E6%8C%81%E7%B1%BB%E5%9E%8B%E6%8E%A8%E6%96%AD%E3%80%82%20let%20%E6%94%AF%E6%8C%81%E5%8F%98%E9%87%8F%E7%B1%BB%E5%9E%8B%E6%8E%A8%E6%96%AD%EF%BC%8C%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B%E6%A0%87%E6%B3%A8%E9%A1%B9%E5%8F%AF%E4%BB%A5%E8%A2%AB%E7%9C%81%E7%95%A5%E3%80%82)

```rust
// variables6.rs
//
// Execute `rustlings hint variables6` or use the `hint` watch subcommand for a
// hint.

// const类型需要声明变量类型

const NUMBER : i32 = 3;
fn main() {
    println!("Number {}", NUMBER);
}
```

# primitive_types3.rs

数组（array）的三要素：

- 长度固定
- 元素必须有相同的类型
- 依次线性排列

数组必须要初始化，以下这种写法会报错：

```rust
fn main() {
    let a:[i32; 100];

    if a.len() >= 100 {
        println!("Wow, that's a big array!");
    } else {
        println!("Meh, I eat arrays like that for breakfast.");
    }
}
```

改为这样就编译通过：

```rust
fn main() {
    let a:[i32; 100] = [0; 100];

    if a.len() >= 100 {
        println!("Wow, that's a big array!");
    } else {
        println!("Meh, I eat arrays like that for breakfast.");
    }
}
```

# vecs2.rs

`iter_mut():` 

iter_mut() 创建一个**可变引用迭代器**。当你想要**修改集合中的元素时**，应使用 iter_mut()。iter_mut() 返回的迭代器将生成集合中每个元素的可变引用。

```rust
let mut v = vec![1, 2, 3];
	for i in v.iter_mut() {
	*i += 1;
}
```

# move_semantics2.rs

```rust
// move_semantics2.rs
//
// Expected output:
// vec0 has length 3, with contents `[22, 44, 66]`
// vec1 has length 4, with contents `[22, 44, 66, 88]`
//
// Execute `rustlings hint move_semantics2` or use the `hint` watch subcommand
// for a hint.
```

**方法1：**

将vec0的内容clone一份传进函数，然后返回值的所有权交给vec1，此时vec1=[22, 44, 66]，vec0=[]

然后再把vec0的内容clone一份传进函数，然后返回值的所有权交给vec0，此时vec1=[22, 44, 66]，vec0=[22, 44, 66]

这个时候不管是vec0还是vec1都拥有一片自己的堆上的空间，二者互不相关，因此vec1.push(88)只会改变vec1的值，且vec0的值也还存在

```rust
fn main() {
    let mut vec0 = Vec::new();

    let mut vec1 = fill_vec(vec0.clone());
    vec0 = fill_vec(vec0.clone());
    println!("{} has length {}, with contents: `{:?}`", "vec0", vec0.len(), vec0);

    vec1.push(88);

    println!("{} has length {}, with contents `{:?}`", "vec1", vec1.len(), vec1);
}

fn fill_vec(vec: Vec<i32>) -> Vec<i32> {
    let mut vec = vec;

    vec.push(22);
    vec.push(44);
    vec.push(66);

    vec
}
```

**方法2：**

首先，创建了vec0的一个可变引用&mut vec0，将这个可变引用传入函数，函数接受一个可变引用类型，然后对其进行操作，也就是操作了vec0指向的那片堆，因此在函数内部，vec0就已经变成了[22, 44, 66]

然后最后返回vec.to_vec()，相当于又创建了一个新的vec，作为vec1绑定的值，因此vec1和vec0又变成了互不相关的

```rust
fn main() {
    let mut vec0 = Vec::new();

    let mut vec1 = fill_vec(&mut vec0); 

    println!("{} has length {}, with contents: `{:?}`", "vec0", vec0.len(), vec0);

    vec1.push(88);

    println!("{} has length {}, with contents `{:?}`", "vec1", vec1.len(), vec1);
}

fn fill_vec(vec: &mut Vec<i32>) -> Vec<i32> {
    let mut vec = vec;

    vec.push(22);
    vec.push(44);
    vec.push(66);

    vec.to_vec()
}
```

# move_semantics4.rs

这个的意思就是函数不再接收参数，而是直接在里面新创建一个包含[22, 44, 66]的vector返回

```rust
// move_semantics4.rs
//
// Refactor this code so that instead of passing `vec0` into the `fill_vec`
// function, the Vector gets created in the function itself and passed back to
// the main function.
//
// Execute `rustlings hint move_semantics4` or use the `hint` watch subcommand
// for a hint.

fn main() {
    // let vec0 = Vec::new();

    let mut vec1 = fill_vec();

    println!("{} has length {} content `{:?}`", "vec1", vec1.len(), vec1);

    vec1.push(88);

    println!("{} has length {} content `{:?}`", "vec1", vec1.len(), vec1);
}

// `fill_vec()` no longer takes `vec: Vec<i32>` as argument
fn fill_vec() -> Vec<i32> {
    let mut vec = Vec::new();

    vec.push(22);
    vec.push(44);
    vec.push(66);

    vec
}
```

# structs3.rs

**结构体，有几点值得注意:**

1. 初始化实例时，**每个字段**都需要进行初始化
2. 初始化时的字段顺序**不需要**和结构体定义时的顺序一致

需要注意的是，必须要将结构体实例声明为可变的，才能修改其中的字段，Rust 不支持将某个结构体某个字段标记为可变。

**结构体方法：**

- **Unlike functions, methods are defined within the context of a struct，**and their **first parameter** is always `self`, which represents the instance of the struct the method is being called on.

- we still need to use the `&` in front of the `self` shorthand to indicate that this method borrows the `Self` instance, just as we did in `rectangle: &Rectangle`. Methods can take ownership of `self`, borrow `self` **immutably**, as we’ve done here, or borrow `self` **mutably**, just as they can any other parameter.

- 方法参数里面不止&self：`package.get_fees(cents_per_gram)`

  比如这个，get_fees是结构体的方法，它在结构体里面是这样定义的：

  ```rust
  fn get_fees(&self, cents_per_gram: i32) -> i32 {
      // Something goes here...
      self.weight_in_grams*cents_per_gram
  }
  ```

  也就是说，第二个参数跟在&self后面就好了，在外部调用结构体时只需要传入那个另外的参数

**例子：**

```rust
// structs3.rs
//
// Structs contain data, but can also have logic. In this exercise we have
// defined the Package struct and we want to test some logic attached to it.
// Make the code compile and the tests pass!
//
// Execute `rustlings hint structs3` or use the `hint` watch subcommand for a
// hint.

// I AM NOT DONE

#[derive(Debug)]
struct Package {
    sender_country: String,
    recipient_country: String,
    weight_in_grams: i32,
}

impl Package {
    fn new(sender_country: String, recipient_country: String, weight_in_grams: i32) -> Package {
        if weight_in_grams <= 0 {
            panic!("Can not ship a weightless package.")
        } else {
            Package {
                sender_country,
                recipient_country,
                weight_in_grams,
            }
        }
    }

    fn is_international(&self) -> bool {
        // Something goes here...
        self.sender_country != self.recipient_country
    }

    fn get_fees(&self, cents_per_gram: i32) -> i32 {
        // Something goes here...
        self.weight_in_grams*cents_per_gram
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[should_panic]
    fn fail_creating_weightless_package() {
        let sender_country = String::from("Spain");
        let recipient_country = String::from("Austria");

        Package::new(sender_country, recipient_country, -2210);
    }

    #[test]
    fn create_international_package() {
        let sender_country = String::from("Spain");
        let recipient_country = String::from("Russia");

        let package = Package::new(sender_country, recipient_country, 1200);

        assert!(package.is_international());
    }

    #[test]
    fn create_local_package() {
        let sender_country = String::from("Canada");
        let recipient_country = sender_country.clone();

        let package = Package::new(sender_country, recipient_country, 1200);

        assert!(!package.is_international());
    }

    #[test]
    fn calculate_transport_fees() {
        let sender_country = String::from("Spain");
        let recipient_country = String::from("Spain");

        let cents_per_gram = 3;

        let package = Package::new(sender_country, recipient_country, 1500);

        assert_eq!(package.get_fees(cents_per_gram), 4500);
        assert_eq!(package.get_fees(cents_per_gram * 2), 9000);
    }
}
```

# enums2.rs

更为复杂的枚举：

Move：包含了一个匿名结构体

Echo：包含了一个String

ChangeColor：包含了三个整数

Quit：没有关联任何数据

```rust
enum Message {
    // TODO: define the different variants used below
    Move { x: i32, y: i32 },
    Echo(String),
    ChangeColor(i32, i32, i32),
    Quit
}
```

# enums3.rs

模式匹配和模式绑定

```rust
// enums3.rs
//
// Address all the TODOs to make the tests pass!
//
// Execute `rustlings hint enums3` or use the `hint` watch subcommand for a
// hint.

// I AM NOT DONE

enum Message {
    // TODO: implement the message variant types based on their usage below
    ChangeColor(u8, u8, u8),
    Echo(String),
    Move(Point),
    Quit
}

struct Point {
    x: u8,
    y: u8,
}

struct State {
    color: (u8, u8, u8),
    position: Point,
    quit: bool,
    message: String
}

impl State {
    fn change_color(&mut self, color: (u8, u8, u8)) {
        self.color = color;
    }

    fn quit(&mut self) {
        self.quit = true;
    }

    fn echo(&mut self, s: String) { self.message = s }

    fn move_position(&mut self, p: Point) {
        self.position = p;
    }

    fn process(&mut self, message: Message) {
        // TODO: create a match expression to process the different message
        // variants
        // Remember: When passing a tuple as a function argument, you'll need
        // extra parentheses: fn function((t, u, p, l, e))
        
        // 模式匹配message
        match message {
		        // 结构枚举类型绑定的值，相当于还完成了语句：Message::ChangeColor(r,g,b)=message
            Message::ChangeColor(r, g, b) => {
                self.change_color((r, g, b));
            }
            Message::Echo(text) => {
                self.echo(text);
            },
            Message::Move(point) => {
                self.move_position(point);
            }
            Message::Quit => {
                self.quit();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_match_message_call() {
		    // 创建了一个结构体变量state，并为其赋值 
        let mut state = State {
            quit: false,
            position: Point { x: 0, y: 0 },
            color: (0, 0, 0),
            message: "hello world".to_string(),
        };
        // 调用结构体内的方法process，参数为枚举类型，每个类型绑定了一个值
        state.process(Message::ChangeColor(255, 0, 255));
        state.process(Message::Echo(String::from("hello world")));
        state.process(Message::Move(Point { x: 10, y: 15 }));
        state.process(Message::Quit);

        assert_eq!(state.color, (255, 0, 255));
        assert_eq!(state.position.x, 10);
        assert_eq!(state.position.y, 15);
        assert_eq!(state.quit, true);
        assert_eq!(state.message, "hello world");
    }
}
```

# strings3.rs

- 字符串的字面量是切片

  一般写字符串可以这样写：`let s = "Hello, world!";`

  实际上，`s` 的类型是 `&str`，因此你也可以这样声明：`let s: &str = "Hello, world!";`

- String转&str：取引用即可

  ```rust
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

- &str转String：`"hello,world".to_string()`或者`String::from("hello,world")`

- String的操作（必须把String声明为mut）

  由于 `String` 是可变字符串，因此只有`String` 这种字符串可以被操作更改

  - `push()`，在末尾追加字符；`push_str()` ，在末尾追加字符串

    这两个方法都是**在原有的字符串上追加，并不会返回新的字符串，即返回值是()**

  - `insert()` 方法插入单个字符，`insert_str()` 方法插入字符串字面量

    也是**在原有的字符串上面操作，没有返回值**

  - `replace`该方法可适用于 `String` 和 `&str` 类型

    **该方法是返回一个新的字符串，而不是操作原来的字符串**

```rust
// strings3.rs
//
// Execute `rustlings hint strings3` or use the `hint` watch subcommand for a
// hint.

// I AM NOT DONE

fn trim_me(input: &str) -> String {
    // TODO: Remove whitespace from both ends of a string!
    input.trim().to_string()
}

fn compose_me(input: &str) -> String {
    // TODO: Add " world!" to the string! There's multiple ways to do this!
    let mut ret: String = input.to_string();
    ret.push_str(" world!"); 
    // push_str没有返回值，因此单独返回ret
    ret
}

fn replace_me(input: &str) -> String {
    // TODO: Replace "cars" in the string with "balloons"!
    let mut ret: String = input.to_string();
    // replace()直接返回新的字符串
	  ret.replace("cars","balloons") 
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

# hashmaps2.rs

**问题1：**

关于hashmap的更新实例中：为什么修改count的值就可以修改hashmap的键值呢？

```rust
use std::collections::HashMap;

let text = "hello world wonderful world";

let mut map = HashMap::new();
// 根据空格来切分字符串(英文单词都是通过空格切分)
for word in text.split_whitespace() {
    let count = map.entry(word).or_insert(0);
    *count += 1;
}

println!("{:?}", map);
```

**解答：**

**`map.entry(word)`** 返回了一个 **`Entry`** 枚举类型的值，该枚举有两个变体：**`Occupied`** 和 **`Vacant`**。**`Entry`** 枚举表示 **`HashMap`** 中某个键对应的条目。

当调用 **`or_insert`** 方法时，如果 **`word`** 对应的条目已经存在，则 **`or_insert`** 方法会返回该条目的值的可变引用（**`Occupied`** 变体），如果该条目不存在，则会在 **`map`** 中插入一个新的键值对，然后返回新插入的值的可变引用（**`Vacant`** 变体）

**问题2：**

这道题里面有这样一个语句：

```rust
**let mut basket = get_fruit_basket();
assert_eq!(*basket.get(&Fruit::Apple).unwrap(), 4);**
```

其中，basket是这样来的：

```rust
fn get_fruit_basket() -> HashMap<Fruit, u32> {
	  let mut basket = HashMap::<Fruit, u32>::new();
	  basket.insert(Fruit::Apple, 4);
	  basket.insert(Fruit::Mango, 2);
	  basket.insert(Fruit::Lychee, 5);
	
	  basket
}
```

所以，为什么basket已经是一个hashmap了，还要用*解引用呢？

**解答：**

*解引用解的不是basket，而是basket.get(&Fruit::Apple)，因为get会返回一个指向该条目键值的引用

跟这段代码一个道理：

```rust
let mut scores = HashMap::new();

// 查询Yellow对应的值，若不存在则插入新值
let v = scores.entry("Yellow").or_insert(5);
assert_eq!(*v, 5); // 不存在，插入5
```

or_insert()会返回一个指向该条目键值的引用，因此也需要把它解引用来跟5比较

# quiz2.rs

这道题主要注意Append这个命令：迭代器是向量中每个元素的引用（想想这是肯定的，不然在for循环里面所有权都丢失了的话有点太危险），而这种引用默认就是不可变引用，那么使用String类型的push_str()自然就是要报错的，因为这个方法是改变原字符串而不是返回一个新的字符串。

```rust
// quiz2.rs
//
// This is a quiz for the following sections:
// - Strings
// - Vecs
// - Move semantics
// - Modules
// - Enums
//
// Let's build a little machine in the form of a function. As input, we're going
// to give a list of strings and commands. These commands determine what action
// is going to be applied to the string. It can either be:
// - Uppercase the string
// - Trim the string
// - Append "bar" to the string a specified amount of times
// The exact form of this will be:
// - The input is going to be a Vector of a 2-length tuple,
//   the first element is the string, the second one is the command.
// - The output element is going to be a Vector of strings.
//
// No hints this time!

pub enum Command {
    Uppercase,
    Trim,
    Append(usize),
}

pub mod my_module {
    use super::Command;

    // TODO: Complete the function signature!
    pub fn transformer(input: Vec<(String, Command)>) -> Vec<String> {
        // TODO: Complete the output declaration!
        let mut output: Vec<String> = vec![];
        for (string, command) in input.iter() {
            // TODO: Complete the function body. You can do it!
            match command {
                Command::Uppercase => {
                    output.push(string.to_uppercase());
                },
                Command::Trim => {
                    output.push(string.trim().to_string());
                },
                Command::Append(size) => {
                    let mut appened_str = string.clone();
                    appened_str.push_str(&"bar".repeat(*size));
                    output.push(appened_str);
                }
            }
        }
        output
    }
}

#[cfg(test)]
mod tests {
    // TODO: What do we need to import to have `transformer` in scope?
    use super::my_module::transformer;
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

# options2.rs

主要是if let语句和while let语句的使用

首先，Option实际上是一种枚举类型，包含两个枚举成员：

```rust
enum Option<T> {
    Some(T),
    None,
}
```

所以下面代码中的if let Some(word) = optional_target {}实际上就是将optional_target这个枚举类型的值结构到word上，然后进行一个操作

while let语句也是一个道理，由于optional_integers的元素都是Some类型的变量，因此首先要把optional_integers的值解构到Some(integer)上，然后再进行操作，因此出现一个Some包裹一个Some

```rust
// options2.rs
//
// Execute `rustlings hint options2` or use the `hint` watch subcommand for a
// hint.

#[cfg(test)]
mod tests {
    #[test]
    fn simple_option() {
        let target = "rustlings";
        let optional_target = Some(target);

        // TODO: Make this an if let statement whose value is "Some" type
        if let Some(word) = optional_target {
            assert_eq!(word, target);
        }
    }

    #[test]
    fn layered_option() {
        let range = 10;
        let mut optional_integers: Vec<Option<i8>> = vec![None];

        for i in 1..(range + 1) {
            optional_integers.push(Some(i));
        }

        let mut cursor = range;

        // TODO: make this a while let statement - remember that vector.pop also
        // adds another layer of Option<T>. You can stack `Option<T>`s into
        // while let and if let.
        while let Some(Some(integer)) = optional_integers.pop() {
            assert_eq!(integer, cursor);
            cursor -= 1;
        }

        assert_eq!(cursor, 0);
    }
}
```

关于if let的详细讲解

[if 和 if let 表达式 - Rust 参考手册 中文版](https://rustwiki.org/zh-CN/reference/expressions/if-expr.html)

# options3.rs

ref和&：

```rust
let c = 'Q';

// 赋值语句中左边的 `ref` 关键字等价于右边的 `&` 符号。
let ref ref_c1 = c;
let ref_c2 = &c;
```

```rust
// options3.rs
//
// Execute `rustlings hint options3` or use the `hint` watch subcommand for a
// hint.

// I AM NOT DONE

struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let y: Option<Point> = Some(Point { x: 100, y: 200 });

    match y {
        Some(ref p) => println!("Co-ordinates are {},{} ", p.x, p.y),
        _ => panic!("no match!"),
    }
    y; // Fix without deleting this line.
}
```

# errors2.rs

关于errors：

- 关于parse：

  parse返回的是一个Result枚举类型，成功的话将会是Result::Ok()，失败是话是Result::Err，因此想获取parse成功时返回的正确值，需要将返回值unwrap()

  ```rust
  fn main() {
     let astr = "7";
  
     let n = astr.parse::<i32>().unwrap();
     println!("{:?}", n);
  
     let n = astr.parse::<i64>().unwrap();
     println!("{:?}", n);
  
     let n = astr.parse::<u32>().unwrap();
     println!("{:?}", n);
  
     let n = astr.parse::<u64>().unwrap();
     println!("{:?}", n);
  
     let astr = "7.42";
     let n: f32 = astr.parse().unwrap();
     println!("{:?}", n);
  
     let n: f64 = astr.parse().unwrap();
     println!("{:?}", n);
  }
  ```

- 认识到Result这个枚举类型：`[Result](https://rustwiki.org/zh-CN/std/result/enum.Result.html)` 是 `[Option](https://rustwiki.org/zh-CN/std/option/enum.Option.html)` 类型的更丰富的版本，描述的是可能的**错误**而不是可能的**不存在**。

  [结果 Result - 通过例子学 Rust 中文版](https://rustwiki.org/zh-CN/rust-by-example/error/result.html)

而做题的时候这个例子，返回的错误类型是`std::num::ParseIntError` 

```rust
// errors2.rs
//
// Say we're writing a game where you can buy items with tokens. All items cost
// 5 tokens, and whenever you purchase items there is a processing fee of 1
// token. A player of the game will type in how many items they want to buy, and
// the `total_cost` function will calculate the total cost of the tokens. Since
// the player typed in the quantity, though, we get it as a string-- and they
// might have typed anything, not just numbers!
//
// Right now, this function isn't handling the error case at all (and isn't
// handling the success case properly either). What we want to do is: if we call
// the `parse` function on a string that is not a number, that function will
// return a `ParseIntError`, and in that case, we want to immediately return
// that error from our function and not try to multiply and add.
//
// There are at least two ways to implement this that are both correct-- but one
// is a lot shorter!
//
// Execute `rustlings hint errors2` or use the `hint` watch subcommand for a
// hint.

// I AM NOT DONE

use std::num::ParseIntError;

pub fn total_cost(item_quantity: &str) -> Result<i32, ParseIntError> {
    let processing_fee = 1;
    let cost_per_item = 5;
    let qty = item_quantity.parse::<i32>();
    // 如果parse()转换成功，qty将会是一个Result::Ok(qty)
    // 如果parse()转换失败，qty将会是一个Result::Err(ParseIntError)
    match qty {
        Ok(qty) => Ok(qty * cost_per_item + processing_fee),
        Err(ParseIntError) => Err(ParseIntError)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn item_quantity_is_a_valid_number() {
        assert_eq!(total_cost("34"), Ok(171));
    }

    #[test]
    fn item_quantity_is_an_invalid_number() {
        assert_eq!(
            total_cost("beep boop").unwrap_err().to_string(),
            "invalid digit found in string"
        );
    }
}
```

还可以用?：

```rust
pub fn total_cost(item_quantity: &str) -> Result<i32, ParseIntError> {
    let processing_fee = 1;
    let cost_per_item = 5;
    // 如果成功就把Ok里面的值给qty，错误就直接返回错误
    let qty = item_quantity.parse::<i32>()?;
    // match qty {
    //     Ok(qty) => Ok(qty * cost_per_item + processing_fee),
    //     Err(ParseIntError) => Err(ParseIntError)
    // }
    
    // 成功就返回费用
    Ok(qty * cost_per_item + processing_fee)
}
```

# errors3.rs

在函数里面使用?:

因为?的逻辑是这样的：

如果返回的不是Err，就正常运行并且将Result枚举类型的值结构给cost

但如果返回的是Err，函数就会立刻终止，然后返回一个Result::Err类型的值，因此必须给函数设置返回值

```rust
// errors3.rs
//
// This is a program that is trying to use a completed version of the
// `total_cost` function from the previous exercise. It's not working though!
// Why not? What should we do to fix it?
//
// Execute `rustlings hint errors3` or use the `hint` watch subcommand for a
// hint.

use std::num::ParseIntError;

fn main() -> Result<(), ParseIntError> {
    let mut tokens = 100;
    let pretend_user_input = "8";

    let cost = total_cost(pretend_user_input)?;

    if cost > tokens {
        println!("You can't afford that many!");
    } else {
        tokens -= cost;
        println!("You now have {} tokens.", tokens);
    }
    Result::Ok(())
}

pub fn total_cost(item_quantity: &str) -> Result<i32, ParseIntError> {
    let processing_fee = 1;
    let cost_per_item = 5;
    let qty = item_quantity.parse::<i32>()?;

    Ok(qty * cost_per_item + processing_fee)
}
```

但是在main函数里面返回一个`Result::Ok(String::from("implement success!"))` 是不合法的，因为`main`函数通常有两种有效的返回类型：`()`（表示成功）和`Result<(), E>`（表示成功或出现错误）。`main`函数的返回类型必须实现`Termination` trait，该trait规定了程序的终止行为

# errors4.rs

可以像这样用匹配：

```rust
fn new(value: i64) -> Result<PositiveNonzeroInteger, CreationError> {
	  match value {
	      x if x < 0 => Err(CreationError::Negative),
	      x if x == 0 => Err(CreationError::Zero),
	      x => Ok(PositiveNonzeroInteger(x as u64)),
	  }
}
```

但感觉这里也可以直接if判断：

```rust
if value > 0 {
    Ok(PositiveNonzeroInteger(value as u64))
} else if value < 0 {
    Err(CreationError::Negative)
} else {
    Err(CreationError::Zero)
}
```

# errors6.rs

转换错误类型：将标准库定义的错误类型转换为自定义的ParsePosNonzeroError

```rust
// errors6.rs
//
// Using catch-all error types like `Box<dyn error::Error>` isn't recommended
// for library code, where callers might want to make decisions based on the
// error content, instead of printing it out or propagating it further. Here, we
// define a custom error type to make it possible for callers to decide what to
// do next when our function returns an error.
//
// Execute `rustlings hint errors6` or use the `hint` watch subcommand for a
// hint.

use std::num::ParseIntError;

// This is a custom error type that we will be using in `parse_pos_nonzero()`.
#[derive(PartialEq, Debug)]
enum ParsePosNonzeroError {
    Creation(CreationError),
    ParseInt(ParseIntError),
}

impl ParsePosNonzeroError {
		// 将错误类型转换为ParsePosNonzeroError的Creation类型
    fn from_creation(err: CreationError) -> ParsePosNonzeroError {
        ParsePosNonzeroError::Creation(err)
    }
    // TODO: add another error conversion function here.
    // 将错误类型转换为ParsePosNonzeroError的ParseInt类型
    fn from_parseint(err: ParseIntError) -> ParsePosNonzeroError {
        ParsePosNonzeroError::ParseInt(err)
    }
}

fn parse_pos_nonzero(s: &str) -> Result<PositiveNonzeroInteger, ParsePosNonzeroError> {
    // TODO: change this to return an appropriate error instead of panicking
    // when `parse()` returns an error.

    // 处理parse()出错的情况
    let x: i64 = s.parse().map_err(ParsePosNonzeroError::from_parseint)?;
    
    // 处理创建时出错的情况
    PositiveNonzeroInteger::new(x).map_err(ParsePosNonzeroError::from_creation)
}

// Don't change anything below this line.

#[derive(PartialEq, Debug)]
struct PositiveNonzeroInteger(u64);

#[derive(PartialEq, Debug)]
enum CreationError {
    Negative,
    Zero,
}

impl PositiveNonzeroInteger {
    fn new(value: i64) -> Result<PositiveNonzeroInteger, CreationError> {
        match value {
            x if x < 0 => Err(CreationError::Negative),
            x if x == 0 => Err(CreationError::Zero),
            x => Ok(PositiveNonzeroInteger(x as u64)),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_parse_error() {
        // We can't construct a ParseIntError, so we have to pattern match.
        assert!(matches!(
            parse_pos_nonzero("not a number"),
            Err(ParsePosNonzeroError::ParseInt(_))
        ));
    }

    #[test]
    fn test_negative() {
        assert_eq!(
            parse_pos_nonzero("-555"),
            Err(ParsePosNonzeroError::Creation(CreationError::Negative))
        );
    }

    #[test]
    fn test_zero() {
        assert_eq!(
            parse_pos_nonzero("0"),
            Err(ParsePosNonzeroError::Creation(CreationError::Zero))
        );
    }

    #[test]
    fn test_positive() {
        let x = PositiveNonzeroInteger::new(42);
        assert!(x.is_ok());
        assert_eq!(parse_pos_nonzero("42"), Ok(x.unwrap()));
    }
}
```

关于map_err：

- Maps a **Result<T, E> to Result<T, F>** by applying a function to a contained Err value, leaving an Ok value untouched.
- 
- 也就是不触发错误返回，而是等待下一步对这个错误的处理

代码：

```rust
// 处理parse()出错的情况
let x: i64 = s.parse().map_err(ParsePosNonzeroError::from_parseint)?;

// 处理创建时出错的情况
PositiveNonzeroInteger::new(x).map_err(ParsePosNonzeroError::from_creation)
```

- 首先`s.parse()`尝试将s进行转换：
  - 如果出错的话，`map_err()`就会返回`ParsePosNonzeroError::from_parseint` 这个自定义的错误类型然后直接返回，而不是`ParseIntError`
  - 如果没出错，`map_err()` 就会返回一个Result::Ok(value)作为s转换后的值——因此后面一定要加?，不然出错的情况确实可以正常返回，但是没出错时Result类型的值是无法与i64类型的x绑定的，而?可以将正常返回的值直接unwrap
- 然后x被成功绑定一个i64类型的整数，就需要判断x是否满足非负数，因此创建一个`PositiveNonzeroInteger` 类型的结构体，x的值作为结构体的值，然后调用结构体方法new()
  - 如果new成功返回Ok(PositiveNonzeroInteger(x as u64))，那么map_err()就返回这个Result::Ok类型的值
  - 如果new出错了返回了一个Result::Err类型的值，那么map_err()就返回`ParsePosNonzeroError::from_creation` 这个自定义的错误类型然后直接返回，而不是`CreationError`

# generics2.rs

使用泛型

```rust
// generics2.rs
//
// This powerful wrapper provides the ability to store a positive integer value.
// Rewrite it using generics so that it supports wrapping ANY type.
//
// Execute `rustlings hint generics2` or use the `hint` watch subcommand for a
// hint.

pub struct Wrapper<T> {
    value: T,
}

impl<T> Wrapper<T> {
    pub fn new(value: T) -> Self {
        Wrapper { value }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn store_u32_in_wrapper() {
        assert_eq!(Wrapper::<i32>::new(42).value, 42);
    }

    #[test]
    fn store_str_in_wrapper() {
        assert_eq!(Wrapper::<&str>::new("Foo").value, "Foo");
    }
}
```

# traits5.rs

特征的多重约束

```rust
// traits5.rs
//
// Your task is to replace the '??' sections so the code compiles.
//
// Don't change any line other than the marked one.
//
// Execute `rustlings hint traits5` or use the `hint` watch subcommand for a
// hint.

pub trait SomeTrait {
    fn some_function(&self) -> bool {
        true
    }
}

pub trait OtherTrait {
    fn other_function(&self) -> bool {
        true
    }
}

struct SomeStruct {}
struct OtherStruct {}

impl SomeTrait for SomeStruct {}
impl OtherTrait for SomeStruct {}
impl SomeTrait for OtherStruct {}
impl OtherTrait for OtherStruct {}

// YOU MAY ONLY CHANGE THE NEXT LINE
fn some_func(item: (impl SomeTrait + OtherTrait)) -> bool {
    item.some_function() && item.other_function()
}

fn main() {
    some_func(SomeStruct {});
    some_func(OtherStruct {});
}
```

# quiz3.rs

关于格式化字符串format!：并不是所有的泛型都可以用这个函数，必须要有Display特征的泛型才可以，因此使用T: Display这个特征约束

`pub fn notify<T: Summary>(item1: &T, item2: &T) {}`

像这段代码的意思就是：约束T必须具有特征Summary，且item1和item2都是T类型的引用

```rust
// quiz3.rs
//
// This quiz tests:
// - Generics
// - Traits
//
// An imaginary magical school has a new report card generation system written
// in Rust! Currently the system only supports creating report cards where the
// student's grade is represented numerically (e.g. 1.0 -> 5.5). However, the
// school also issues alphabetical grades (A+ -> F-) and needs to be able to
// print both types of report card!
//
// Make the necessary code changes in the struct ReportCard and the impl block
// to support alphabetical report cards. Change the Grade in the second test to
// "A+" to show that your changes allow alphabetical grades.
//
// Execute `rustlings hint quiz3` or use the `hint` watch subcommand for a hint.

// I AM NOT DONE

use std::fmt::Display;

// 因为成绩既有字符串又有浮点数，因此定义grade为一个泛型
pub struct ReportCard<T> {
    pub grade: T,
    pub student_name: String,
    pub student_age: u8,
}
// 这里规定T必须是具有Display特征的类型 
impl<T: Display> ReportCard<T> {
    pub fn print(&self) -> String {
        format!("{} ({}) - achieved a grade of {}",
            &(*self).student_name, &self.student_age, &self.grade) 
            // 这里访问self字段时隐式解引用，但你要手动解引用也可以
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_numeric_report_card() {
        let report_card = ReportCard {
            grade: 2.1,
            student_name: "Tom Wriggle".to_string(),
            student_age: 12,
        };
        assert_eq!(
            report_card.print(),
            "Tom Wriggle (12) - achieved a grade of 2.1"
        );
    }

    #[test]
    fn generate_alphabetic_report_card() {
        // TODO: Make sure to change the grade here after you finish the exercise.
        let report_card = ReportCard {
            grade: String::from("A+"),
            student_name: "Gary Plotter".to_string(),
            student_age: 11,
        };
        assert_eq!(
            report_card.print(),
            "Gary Plotter (11) - achieved a grade of A+"
        );
    }
}
```

# lifetimes3.rs

关于结构体的生命周期：

不仅仅函数具有生命周期，结构体其实也有这个概念，只不过我们之前对结构体的使用都停留在非引用类型字段上。细心的同学应该能回想起来，之前为什么不在结构体中使用字符串字面量或者字符串切片，而是统一使用 `String` 类型？原因很简单，后者在结构体初始化时，只要转移所有权即可，而前者，抱歉，它们是引用，它们不能为所欲为。

既然之前已经理解了生命周期，那么意味着在结构体中使用引用也变得可能：只要为结构体中的**每一个引用标注上生命周期**即可：

```rust
struct ImportantExcerpt<'a> {
    part: &'a str,
}

fn main() {
    let novel = String::from("Call me Ishmael. Some years ago...");
    let first_sentence = novel.split('.').next().expect("Could not find a '.'");
    let i = ImportantExcerpt {
        part: first_sentence,
    };
}
```

**结构体 `ImportantExcerpt` 所引用的字符串 `str` 生命周期需要大于等于该结构体的生命周期**。

# iterators2.rs

迭代器：

- 迭代器是会被消耗的：

  当使用了next()，迭代器就会被消耗，相当于取出了那一个元素，那个元素其实已经不在迭代器里面了，因此最开始我直接将first转换为大写后直接返回了迭代器剩余的元素，这会导致返回的字符串没有预期的第一个字符

  ```rust
  // Step 1.
  // Complete the `capitalize_first` function.
  // "hello" -> "Hello"
  pub fn capitalize_first(input: &str) -> String {
      let mut c = input.chars();
      match c.next() {
          None => String::new(),
          Some(first) => {
              let mut first_upp: String = first.to_uppercase().collect();
              let chars_str: String = c.collect();
              first_upp.push_str(&chars_str);
              first_upp
          }
      }
  }
  ```

# iterators4.rs

[使用迭代器处理元素序列 - Rust 程序设计语言 中文版](https://rustwiki.org/zh-CN/book/ch13-02-iterators.html#消费迭代器的方法)

用迭代器实现递归：**使用消费者适配器的方法**

```rust
pub fn factorial(num: u64) -> u64 {
    // Complete this function to return the factorial of num
    // Do not use:
    // - return
    // Try not to use:
    // - imperative style loops (for, while)
    // - additional variables
    // For an extra challenge, don't use:
    // - recursion
    // Execute `rustlings hint iterators4` for hints.
    (1..=num).product()
}
```

在 Rust 中，`(1..=num)` 是一个范围（Range）表达式，表示从1到`num`（包括`num`本身）的一个范围。**这个范围实际上是一个迭代器**，它可以生成从1到`num`的所有数字序列。

在这种情况下，我们可以通过 `(1..=num)` 创建一个包含从1到`num`的数字序列的迭代器。然后，我们调用迭代器的 `product()` 方法，这个方法将迭代器中的所有元素相乘，得到它们的乘积作为结果。

因此，`(1..=num).product()` 这个语句的意思是：先生成从1到`num`的数字序列迭代器，然后计算这个序列中所有数字的乘积，最终得到阶乘的结果。

# iterators5.rs

关于闭包和迭代器方法的使用

不用循环，找出map里面有多少个键值为value的元素

```rust
fn count_iterator(map: &HashMap<String, Progress>, value: Progress) -> usize {
    // map is a hashmap with String keys and Progress values.
    // map = { "variables1": Complete, "from_str": None, ... }
    map.values().filter(|progress| **progress == value).count()
}
```

- `.values()`：使用了HashMap的value方法，获取了一个包含所有键值的迭代器。

  **`pub fn [values](https://rustwiki.org/zh-CN/std/collections/struct.HashMap.html#method.values)(&self) -> [Values](https://rustwiki.org/zh-CN/std/collections/hash_map/struct.Values.html)<'_, K, V>`**一个以任意顺序访问所有值的迭代器。 迭代器元素类型为 `&'a V` ，即对键值的引用

- `.filter()`  ：**创建一个迭代器**，该迭代器使用闭包确定是否应产生元素。给定一个元素，闭包必须返回 `true` 或 `false`。返回的迭代器将仅生成闭包为其返回 true 的元素。

- `.count()` ：消耗迭代器，计算迭代次数并返回它。此方法将反复调用 `[next](https://rustwiki.org/zh-CN/std/iter/trait.Iterator.html#tymethod.next)`，直到遇到 `[None](https://rustwiki.org/zh-CN/std/option/enum.Option.html#variant.None)，`并返回它看到 `[Some](https://rustwiki.org/zh-CN/std/option/enum.Option.html#variant.Some)` 的次数。 请注意，即使迭代器没有任何元素，也必须至少调用一次 `[next](https://rustwiki.org/zh-CN/std/iter/trait.Iterator.html#tymethod.next)`。

返回一个所有哈希表里面键值为指定状态的数量和：

```rust
fn count_collection_iterator(collection: &[HashMap<String, Progress>], value: Progress) -> usize {
    // collection is a slice of hashmaps.
    // collection = [{ "variables1": Complete, "from_str": None, ... },
    //     { "variables2": Complete, ... }, ... ]
    collection.iter().map(|map| count_iterator(map, value)).sum()
}
```

- `.map()` ：Iterator特征的函数，获取一个闭包并**创建一个迭代器**，该迭代器在每个元素上调用该闭包。
- 首先创建collection的迭代器，再使用map使得迭代器上的每个元素都调用count_iterator()，对于每个哈希表都计算键值为progress的个数
- `.sum()` ：将迭代器里面的每个元素相加，所以这么写也是对的：

```rust
let iter = collection.iter().map(|map| count_iterator(map, value));
iter.sum()
```
# box1.rs——智能指针

[Box堆对象分配 - Rust语言圣经(Rust Course)](https://course.rs/advance/smart-pointer/box.html#将动态大小类型变为-sized-固定大小类型)

```rust
// 使用Box来定义Cons，将List存到堆上，那么List的大小就固定了
pub enum List {
    Cons(i32, Box<List>),
    Nil,
}

pub fn create_empty_list() -> List {
    List::Nil
}

pub fn create_non_empty_list() -> List {
    List::Cons(1, Box::new(List::Cons(2, Box::new(List::Nil))))
}
```

# threads1.rs

```rust
fn main() {
		// 创建handles，用以存储后面10个线程的句柄 
    let mut handles = vec![];
		
		// 通过循环创建了10个线程，每个线程会执行一个闭包
    for i in 0..10 {
		    // 使用move拿走当前i的所有权
        handles.push(thread::spawn(move || {
            let start = Instant::now();
            thread::sleep(Duration::from_millis(250));
            
            // 250ms后输出，因为i的所有权被拿到了，因此可以访问i
            println!("thread {} is complete", i);
            start.elapsed().as_millis()
        }));
    }
		
		// 创建results，用以存储10个线程的执行时间
    let mut results: Vec<u128> = vec![];
    for handle in handles {
        // TODO: a struct is returned from thread::spawn, can you use it?
        // 等待每个线程执行完成再结束主线程
        results.push(handle.join().unwrap());
    }
    
    // 输出时间
    for (i, result) in results.into_iter().enumerate() {
        println!("thread {} took {}ms", i, result);
    }
}
```

- 线程返回值是如何得到的？

  在 `handle.join().unwrap()` 中，`join()` 方法会等待线程执行完成并获取线程的返回值，即每个线程的执行时间（以毫秒为单位），然后通过 `unwrap()` 方法将其取出并存储在 `results` 向量中。

  ![Untitled](https://cdn.jsdelivr.net/gh/Easter1995/blog-image/202404241805103.png)

- 线程编号和时间是如何输出的？

  `results.into_iter().enumerate()`: `into_iter()` 方法将 `results` 向量转换为一个拥有所有权的迭代器，`enumerate()` 方法对迭代器进行索引迭代，返回一个元组 `(index, value)`，其中 `index` 表示元素在迭代器中的索引，`value` 表示元素的值。

# threads3.rs——多个发送者

为什么这里需要克隆发送方？

- 因为thread使用了闭包关键字move，这会使得在创建第一个线程时，tx的所有权已经被移到了第一个线程里面，第二个线程还想用tx发送信息自然是做不到的
- 因此克隆一个tx，第二个线程就可以使用了

```rust
fn send_tx(q: Queue, tx: mpsc::Sender<u32>) -> () {
    let qc = Arc::new(q);
    let qc1 = Arc::clone(&qc);
    let qc2 = Arc::clone(&qc);
    // 克隆发送方
    let tx_clone = tx.clone();

    thread::spawn(move || {
        for val in &qc1.first_half {
            println!("sending {:?}", val);
            tx.send(*val).unwrap();
            thread::sleep(Duration::from_secs(1));
        }
    });

    thread::spawn(move || {
        for val in &qc2.second_half {
            println!("sending {:?}", val);
            // 使用克隆的发送方
            tx_clone.send(*val).unwrap();
            thread::sleep(Duration::from_secs(1));
        }
    });
}
```

# macros3.rs

- 使用macro_rules!来定义宏
- 宏的定义必须在调用之前
- 通过在 `my_macro` 宏定义前加上 `#[macro_export]` 属性，使得宏可以在模块外部使用

```rust
pub mod macros {
    #[macro_export]
    macro_rules! my_macro {
        () => {
            println!("Check out my macro!");
        };
    }
}

fn main() {
    my_macro!();
}
```

# macros4.rs

模式匹配：

1. `$()` 中包含的是模式 `$x:expr`，该模式中的 `expr` 表示会匹配任何 Rust 表达式，并给予该模式一个名称 `$x`
2. 因此 `$x` 模式可以跟整数 `1` 进行匹配，也可以跟字符串 "hello" 进行匹配: `vec!["hello", "world"]`
3. `$()` 之后的逗号，意味着`1` 和 `2` 之间可以使用逗号进行分割，也意味着 `3` 既可以没有逗号，也可以有逗号：`vec![1, 2, 3,]` 
4. `*`说明之前的模式可以出现零次也可以任意次，这里出现了三次

匹配一次：

```rust
#[rustfmt::skip]
macro_rules! my_macro {
    () => {
        println!("Check out my macro!");
    };
    ($val:expr) => {
        println!("Look at this other macro: {}", $val);
    };
}

fn main() {
    my_macro!();
    my_macro!(7777);
}
```

匹配多次：

```rust
#[rustfmt::skip]
macro_rules! my_macro {
    () => {
        println!("Check out my macro!");
    };
    ($($val:expr),*) => {
        $(
            println!("Look at this other macro: {}", $val);
        )*
    };
}

fn main() {
    my_macro!();
    my_macro!(7777, 999, "hello");
}
```

# tests5.rs——裸指针和unsafe

- 在裸指针 `*const T` 中，这里的 `*` 只是类型名称的一部分，并没有解引用的含义

- 下面的代码**基于值的引用**同时创建了可变和不可变的裸指针，**创建裸指针是安全的行为，而解引用裸指针才是不安全的行为** :

  ```rust
  let mut num = 5;
  
  let r1 = &num as *const i32; // 不可变裸指针
  let r2 = &mut num as *mut i32; // 可变裸指针
  ```

# algorithm1——合并链表

```rust
pub fn merge(list_a:LinkedList<T>,list_b:LinkedList<T>) -> Self
	{
		//TODO
        let mut merged_list = LinkedList::new();
        // 获取链表的开始节点
        let mut node_a = list_a.start; 
        let mut node_b = list_b.start;
        
        while node_a.is_some() || node_b.is_some() {
            // 指针解引用，其中一个指针有可能为None
            // 但是不获得val的所有权
            let a_val = node_a.map(|ptr| unsafe{ &(*ptr.as_ptr()).val });
            let b_val = node_b.map(|ptr| unsafe{ &(*ptr.as_ptr()).val });

            // 比较大小
            match (a_val, b_val) {
                // 两个都非空
                (Some(a), Some(b)) => {
                    if a < b {
                        merged_list.add(a.clone());
                        // 指针解引用且获得指针内容的所有权
                        node_a = unsafe{ (*node_a.unwrap().as_ptr()).next };
                    } else {
                        merged_list.add(b.clone());
                        node_b = unsafe{ (*node_b.unwrap().as_ptr()).next };
                    }
                },
                // a已经空了，直接把b剩下的元素全部加进链表
                (None, Some(b)) => {
                    merged_list.add(b.clone());
                    node_b = unsafe{ (*node_b.unwrap().as_ptr()).next };
                },
                (Some(a), None) => {
                    merged_list.add(a.clone());
                    node_a = unsafe{ (*node_a.unwrap().as_ptr()).next };
                },
                (None, None) => {
                    break
                }
            }
        }

        merged_list
	}
```

# algorithm2——链表反转

- 因为用到了clone，因此必须限定T是具有Clone特征的泛型

- 方法一

  - 使用`std::mem::replace(self, reversed_list);` 交换新链表和self的所有权

- 方法二

  - 直接将新链表的所有权交给self

  ```rust
  impl<T: Clone> LinkedList<T> {
  	pub fn reverse(&mut self){
  		let mut reversed_list = LinkedList::new();
          // 获取链表的末尾节点
          let mut current_node = self.end;
          while current_node.is_some() {
              // 获取当前节点值的引用
              let value = current_node.map(|ptr| unsafe{ &(*ptr.as_ptr()).val });
              match value {
                  Some(x) => {
                      // 新链表加入x
                      reversed_list.add(x.clone());
                      // 指向上一个节点
                      current_node = unsafe{ (*current_node.unwrap().as_ptr()).prev };
                  }
                  None => break
              }
          }
          // 交换新链表和原链表的所有权
          // std::mem::replace(self, reversed_list);
          *self = reversed_list;
      }
  }
  ```

- 其中while循环那段可以这样改：

  ```rust
  while let Some(node_ptr) = current_node {
      let value = unsafe { &(*node_ptr.as_ptr()).val }; // 因为node_ptr肯定是Some类型的，其值一定存在
      reversed_list.add(value.clone());
      current_node = unsafe { (*node_ptr.as_ptr()).prev };
  }
  ```

# algorithm4——二叉查找树

- 因为要递归实现插入和查找，所以应该将search和insert实现为TreeNode的方法，所以TreeNode方法的实现应该要写在最前面

- 二叉树节点的方法：

  ```rust
  // 此时self是二叉树里面的一个节点
  fn insert(&mut self, value: T) {
      match value.cmp(&self.value) {
          // 要插入的节点小于当前节点
          Ordering::Less => {
              // 应该把它往左边递归
              match &mut self.left {
                  Some(left) => {
                      // 如果左指针有值，就继续递归
                      // 左指针是一个Box
                      (*left).insert(value);
                  }
                  _ => {
                      // 如果左指针指向None，就让它指向新建节点
                      self.left = Some(Box::new(TreeNode::new(value)));
                  }
              }
          }
          Ordering::Greater => {
              // 应该把它往右边递归
              match &mut self.right {
                  Some(right) => {
                      // 如果右指针有值，就继续递归
                      // 右指针是一个Box
                      (*right).insert(value);
                  }
                  _ => {
                      // 如果右指针指向None，就让它指向新建节点
                      self.right = Some(Box::new(TreeNode::new(value)));
                  }
              }
          }
          _ => {} // 相等时不插入新节点
      }
  }
  ```

  ```rust
  fn search(&self, value: T) -> bool {
  	  match value.cmp(&self.value) {
  	      Ordering::Less => {
  	          // 说明应该往当前节点的左边找
  	          match &self.left {
  	              Some(left) => { return left.search(value); }
  	              _ => { return false; }
  	          }
  	      }
  	      Ordering::Greater => {
  	          // 说明应该往当前节点的右边找
  	          match &self.right {
  	              Some(right) => { return right.search(value); }
  	              _ => { return false; }
  	          }
  	      }
  	      _ => { return true; }
  	  }
  }
  ```

- 二叉树的方法

  ```rust
  // Insert a value into the BST
  fn insert(&mut self, value: T) {
      // 直接使用节点的插入方法
      match &mut self.root {
          Some(root_node) => {
              root_node.insert(value);
          }
          _ => {
              self.root = Some(Box::new(TreeNode::new(value)));
          }
      }
  }
  ```

  ```rust
  // Search for a value in the BST
  fn search(&self, value: T) -> bool {
      match &self.root {
          Some(root_node) => { root_node.search(value) }
          _ => { false }
      }
  }
  ```

  # algorithm7——用Vec实现栈

  ```rust
  // 坑：size记得-=1
  fn pop(&mut self) -> Option<T> {
  		if self.size > 0 {
  			self.size -= 1;
  		}
  		self.data.pop()
  	}
  ```

  ```rust
  fn bracket_match(bracket: &str) -> bool
  {
  	let mut stack = Stack::new();
  	// 遍历字符串里面的字符
  	for chr in bracket.chars() {
  		// 扫描到左括号就入栈
  		if chr == '(' || chr == '{' || chr == '[' {
  			stack.push(chr);
  		} 
  		if chr == ')' || chr == '}' || chr == ']' {
  			if stack.is_empty() {
  				return false;
  			}
  			if let Some(stack_top) = stack.pop() {
  				if chr == ')' {
  					if stack_top != '(' { return false; }
  				} else if chr == '}' {
  					if stack_top != '{' { return false; }
  				} else if chr == ']' {
  					if stack_top != '[' { return false; }
  				}
  			}
  		}
  	}
  	stack.is_empty()
  }
  ```

  # algorithm8——两个队列实现栈

  ```rust
  // 出队，出第一个元素
  pub fn dequeue(&mut self) -> Result<T, &str> {
      if !self.elements.is_empty() {
          Ok(self.elements.remove(0usize))
      } else {
          Err("Stack is empty") // 坑：记得把原来的“Queue”改成“Stack”
      }
  }
  
  // 看队头的元素的值
  pub fn peek(&self) -> Result<&T, &str> {
      match self.elements.first() {
          Some(value) => Ok(value),
          None => Err("Stack is empty"),
      }
  }
  ```

  ```rust
  pub fn push(&mut self, elem: T) {
      self.q1.enqueue(elem); // 入队列q1
  }
  
  pub fn pop(&mut self) -> Result<T, &str> {
      // 将q1里面的除最后一个元素依次出栈存到q2
      for n in 1..self.q1.size() {
          if let Ok(value) = self.q1.dequeue() {
              self.q2.enqueue(value);
          }
      }
      std::mem::swap(&mut self.q1, &mut self.q2); // 交换q1、q2所有权
      self.q2.dequeue() // q2负责出队
  }
  
  pub fn is_empty(&self) -> bool {
  		self.q1.is_empty() && self.q2.is_empty()
  }
  ```

  # algorithm9——堆排序

  ```rust
  impl<T> Heap<T>
  where
      T: Default + std::cmp::PartialOrd
  {
      pub fn new(comparator: fn(&T, &T) -> bool) -> Self {
          Self {
              count: 0,
              items: vec![T::default()], // 从下标为1的地方开始存堆
              comparator,
          }
      }
  
      pub fn len(&self) -> usize {
          self.count
      }
  
      pub fn is_empty(&self) -> bool {
          self.len() == 0
      }
  
      pub fn add(&mut self, value: T) {
          self.count += 1; // index从1开始
          self.items.push(value); // 先在堆的最后添加一个节点
          let mut index = self.count;
          
          while index > 1 {
              let parent_idx = self.parent_idx(index); // 获取最后一个元素的父元素
              if (self.comparator)(&self.items[index], &self.items[parent_idx]) {
                  self.items.swap(index, parent_idx); // 将它和父元素交换
                  index = parent_idx; // 发生交换后index移动到父元素的位置
              } else {
                  break;
              }
          }
      }
  
      fn parent_idx(&self, idx: usize) -> usize {
          idx / 2
      }
  
      // 判断idx是否有孩子
      fn children_present(&self, idx: usize) -> bool {
          self.left_child_idx(idx) <= self.count
      }
  
      fn left_child_idx(&self, idx: usize) -> usize {
          idx * 2
      }
  
      fn right_child_idx(&self, idx: usize) -> usize {
          self.left_child_idx(idx) + 1
      }
  
      // 按堆规定的顺序返回两个孩子中应该在前面的一个的索引值
      fn smallest_child_idx(&self, idx: usize) -> usize {
          let left = self.left_child_idx(idx);
          let right = self.right_child_idx(idx);
          if right > self.count {
              left
          } else if (self.comparator)(&self.items[left], &self.items[right]) {
              left
          } else {
              right
          }
      }
  }
  ```

  ```rust
  fn next(&mut self) -> Option<T> {
      if self.count == 0 {
          return None;
      }
      // 相当于堆排序
      let ret = self.items.swap_remove(1); // 将堆顶元素输出，堆底元素升上来
      self.count -= 1;
      // 再次调整堆为大根堆或小根堆
      let mut index = 1;
      // 当当前元素有子元素时
      while self.children_present(index) {
          let child_index = self.smallest_child_idx(index);
          if (self.comparator)(&self.items[child_index], &self.items[index]) {
              self.items.swap(child_index, index);
              index = child_index;
          }
          else {
              break; // 如果不break会进入死循环
          }
      }
  
      Some(ret)
  }
  ```

  # algorithm10——图

  用到了`get_mut()`

  ```rust
  // 无向图结构的邻接表，用HashMap来存储，键是String，键值是一个向量，其中i32可能表示边长
  pub struct UndirectedGraph {
      adjacency_table: HashMap<String, Vec<(String, i32)>>,
  }
  impl Graph for UndirectedGraph {
      fn new() -> UndirectedGraph {
          UndirectedGraph {
              adjacency_table: HashMap::new(),
          }
      }
      // 获取邻接表的可变引用
      fn adjacency_table_mutable(&mut self) -> &mut HashMap<String, Vec<(String, i32)>> {
          &mut self.adjacency_table
      }
      // 获取邻接表的引用
      fn adjacency_table(&self) -> &HashMap<String, Vec<(String, i32)>> {
          &self.adjacency_table
      }
      // 添加边
      fn add_edge(&mut self, edge: (&str, &str, i32)) {
          // 要在三元组的第一个str和第二个str之间加边
          let (vertice1, vertice2, weight) = edge;
          
          // 如果第一个点查询得到
          if let Some(adj1) = self.adjacency_table_mutable().get_mut(&String::from(vertice1)) {
              adj1.push((String::from(vertice2), weight));
          } else {
              self.add_node(vertice1);
              if let Some(new_adj1) = self.adjacency_table_mutable().get_mut(vertice1) {
                  new_adj1.push((String::from(vertice2), weight));
              }
          }
  
          // 如果第二个点查询得到
          if let Some(adj2) = self.adjacency_table_mutable().get_mut(vertice2) {
              adj2.push((String::from(vertice1), weight));
          } else {
              self.add_node(vertice2);
              if let Some(new_adj2) = self.adjacency_table_mutable().get_mut(&String::from(vertice2)) {
                  new_adj2.push((String::from(vertice1), weight));
              }
          }
      }
  }
  ```

  ```rust
  // 添加成功返回true，添加失败返回false
  fn add_node(&mut self, node: &str) -> bool {
      if self.contains(node) {
          return false;
      }
      else {
          self.adjacency_table_mutable().insert(node.to_string(), Vec::new());
          return true;
      }
  }
  // 在结构体方法中实现了
  fn add_edge(&mut self, edge: (&str, &str, i32));
  ```