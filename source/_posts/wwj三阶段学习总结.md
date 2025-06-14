---
title: wwj三阶段学习总结
date: 2025-05-30 10:26:23
tags:
    - author:Keranthos
    - repo:https://github.com/LearningOS/2025s-rcore-Keranthos
---



# RUST学习总结

### 函数：

- 函数名和变量名使用[蛇形命名法(snake case)](https://course.rs/practice/naming.html)，例如 `fn add_two() -> {}`
- 函数的位置可以随便放，Rust 不关心我们在哪里定义了函数，只要有定义即可
- 每个函数参数都需要标注类型

### 所有权

基础类型：不会转移所有权，属于复制变量的值

复合类型：会转移所有权，相当于重新绑定变量

 （深拷贝：`复合类型变量名.clone()`，不转移所有权）

**引用**

- 以`&`表示引用，以`*`表示解引用
- 可变引用首先要求变量可变，引用时也要写成`&mut 变量名`，否则是可变变量的不可变引用
- 一个变量的可变引用同时只能存在一个，可变与不可变引用不可同时存在
- “同时”指引用的作用域，为引用”从创建开始，一直持续到它最后一次使用的地方“



### 复合类型

#### 字符串

切片：对`string`类型中某一部分的引用，即`&变量名[开始……终止]`，切片类型为`&str`

`string`与`&str`的转化：

 `&str`化成`string`: `String::from("字符串字面量")`/`"字符串字面量".to_string()`

 `string`化成`&str`: 取切片

**操作字符串**（针对于`string`）

- 追加：`push(字符)/push_str(字符串字面量（不能是string类型）)` 改变原有的字符串（不返回新值，必须`mut`可变）
- 插入：`insert()/insert_str()` 需要传入两个参数，第一个是插入位置索引，第二个是插入内容 改变原有字符串
- 替换：`replace(被替换的字符串，新的字符串)` 返回新的字符串（需要新变量接收）

```
let string_replace = String::from("I like rust. Learning rust is my favorite!");
let new_string_replace = string_replace.replace("rust", "RUST");
```

 `replacen(被替换的字符串，新的字符串，替换的个数)` 返回新的字符串

 `replace_range(要替换的范围，新的字符串)` 改变原有的字符串

- 删除：`pop()` 删除并返回最后一个字符 改变原有的字符串

 `remove(字符起始索引)` 删除并返回指定位置的字符 改变原有的字符串

 `truncate(字符起始索引)` 删除指定位置至结尾的所有字符 改变原有字符串

 `clear()` 清空字符串

- 连接：`+/+=` 相当于调用函数`add(self, s:&str……)` 第一个参数是`string`,其所有权会被转移，后面的参数需要`&str`类型 `'+'返回新的字符串`

   `format!("{}", s)` 用法与`println!`类似， 返回新的字符串

**注：**此处所有涉及索引的方法（包括切片），都是以字节为单位处理数据；对于`UTF-8`类型字符非常容易出错



#### 结构体

```
1、// 定义字段
struct 结构体名称 {
    字段名称1： 类型 //结构体字段
}
gree
2、// 初始化：每个字段都要初始化，但顺序不一定一样
let 变量名 =  结构体名称 {
    字段名称1： 值 
}
let 变量名 =  结构体名称 {
    字段名称1： 值 
    ..另一个同类型变量2名的名称	//	剩余自动从另一变量中获取（该语句必须位于尾部）
    				//	同时变量2部分字段会发生所有权转移
}

3、// 访问字段
变量名.字段名	

4、// 元组结构体、单元结构体
let a : (i32, f64, u8) = (500, 6.4, 1); // (i32, f64, u8)是元组
struct Color(i32, i32, i32); // 元组结构体，适用于结构体有名称，字段没有的情况
struct AlwaysEqual; // 单元结构体，没有属性与字段

5、 // 结构体数据所有权：字段值最好不要基于引用，否则需要加上生命周期

6、 // 正常情况无法{}打印，需要在开头加上#[derive(Debug)]，使用{:?}或{:#?}来打印
```



#### 枚举

枚举类型是一个类型，它会包含所有可能的枚举成员，而枚举值是该类型中的具体某个成员的实例

```
// 枚举变体携带数据
enum PokerCard {
    Clubs(u8),
    Spades(u8),
    Diamonds(char),
    Hearts(char),
} // 任何类型的数据都可以放入枚举成员中，包括另一个枚举或者结构体
let c1 = PokerCard::Spades(5);
```



#### 数组

分为静态的`array`和动态数组`vector`，先看`array`

`array`可以正常使用下标访问，可以使用`{:?}`打印

```
let a = [1, 2, 3, 4, 5]; // 定义
let a: [i32; 5] = [1, 2, 3, 4, 5]; // 需要声明类型时
let a = [3; 5]; // 某个值重复出现
let arrays: [[u8; 3]; 4]  = [one, two, blank1, blank2]; // 二维数组

let slice: &[i32] = &a[1..3]; // 数组切片
```



### 流程控制

**if:** `if`语句块是表达式，可以有返回值

**for**

```
for 元素 in 集合/0..集合.len() { // 注意，此处集合需要使用引用，否则所有权会被转移（如需更改加上mut）
}

// 想要获取元素的索引
let a = [4, 3, 2, 1];
for (i, v) in a.iter().enumerate() {
    println!("第{}个元素是{}", i + 1, v); // .iter()方法把 `a` 数组变成一个迭代器
}

// 只在意循环次数
for _ in 0..10 {
}
```

`continue`与`break`依然存在

**while**

```
while 条件 {}
```

**loop**

无条件循环，必须搭配`break`

（`break`类似于`return`，可以单独使用也可以带回来一个返回值；

 loop同样是表达式，可以返回一个值）



### 模式匹配

#### match和if let

**match:** 非常类似于`switch`(但匹配后只会执行当前分支，而不会往下”贯穿“)

`match`同样是表达式，可以有返回值

```
match target {
    模式1 => 表达式1, // =>代替了:
    模式2 | 模式3 => {	// X|Y
        语句1;
        语句2;
        表达式2 // 注意，语句同样可以返回()
    },
    _ => 表达式3 // _代替了default，必须穷尽所有情况否则会报错
    //或者 任意无关变量名 => 表达式3  // 此时就可以对该变量操作，不操作记得使用_开头
}
```

模式绑定（从匹配到的分支中取出绑定的值）

```
enum Coin {
    Penny,
    Nickel,
    Dime,
    Quarter(UsState), // 25美分硬币
}
match coin {
        Coin::Penny => 1,
        Coin::Nickel => 5,
        Coin::Dime => 10,
        Coin::Quarter(state) => {
            println!("State quarter from {:?}!", state); // 可以取出绑定的具体state值
            25
        },
    }
```

**if let:** 适用于只需要判断一个模式是否匹配的情况,比`if`更适用于匹配

```
let some_value = Some(5);
if let Some(v) = some_value {
    println!("Value is: {}", v);
}
```

**while let:** while和let的总和，即如果满足条件就可循环，同样可以从模式匹配中拆出值

**注：**match/if let/while let都会转移被匹配值的借用值的所有权，需要使用`ref`抵消（`ref`只在左侧生效）

```
if let Some(ref x) = value
match opt {
    Some(ref s) => println!("Got a reference to string: {}", s),
```



#### `Option<T>`

表示一个值是否存在的**枚举**(`Some<T>`与`T`不是同一类型)

对于`Some`和`None`可以不加`Option::`前缀

```
enum Option<T> {
    Some(T),  // 表示有值
    None,     // 表示无值
}

//存储
let x: Option<i32> = Some(42);  // Some(42) 代表 x 里面存了 42
let y: Option<i32> = None;      // None 代表没有值

//解构
match x {
    Some(v) => println!("Value is: {}", v),  // 取出 v
    None => println!("No value"),
}
if let Some(v) = x {
    println!("Value is: {}", v);
}
```



### 方法

`impl`中存储方法与`struct`中声明字段分开，同时一个结构体可以有多个`impl`块

```
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn area(&self) -> u32 {
        self.width * self.height
    }
} // &self代替了self:&Self
```

**注：**

- `self` 表示 `Rectangle` 的所有权转移到该方法中，这种形式用的较少

  `&self` 表示该方法对 `Rectangle` 的不可变借用

  `&mut self` 表示可变借用

- 允许方法名和字段名相同

- 在调用方法时只有`.`没有`->`

- 枚举同样可以定义方法

**关联函数**

定义在结构体`impl`且没有`self`的函数

不能使用`变量.函数()`的方法调用，只能使用`结构体名称::函数名(参数)`来调用

比如`String::from()`



### 泛型

为了抽象不同的类型

```
fn 函数名<T>(变量名: T) -> T { // 函数泛型
struct Point<T> {
    x: T,
    y: T,
} // 结构体泛型，多个类型也可以声明如struct Point<T,U>
enum Result<T, E> {
    Ok(T),
    Err(E),
} // 枚举泛型，可以根据返回值的类型判断是否成功
struct Point<T, U> {
    x: T,
    y: U,
}

impl<T, U> Point<T, U> { 
    fn mixup<V, W>(self, other: Point<V, W>) -> Point<T, W> {
        Point {
            x: self.x,
            y: other.y,
        }
    }
} // 结构体泛型，impl处需要另外声明，impl中的方法可以拥有自己的泛型
  //对于结构体泛型，还可以为特定的泛型单独声明方法
```

- 在使用`T`前需要先声明`<T>`，`T`的名字可以随便取
- 有时在调用泛型函数时需使用`函数名::<具体类型>()`来显式指定`T`的类型

**const泛型**

允许常量值成为泛型变量，语法为`const N: usize`，表示const泛型N，它的值基于`usize`

```
struct Buffer<T, const N: usize> {
    data: [T; N], // N 作为数组大小
}
```

`const fn:` 在函数声明前加上`const`关键字

**注：**`const`泛型与`const fn`都需要在编译时确定，`const fn`就可以用于给`const`泛型赋值



### 特征

定义了一组可以被共享的行为，只要实现了特征，你就能使用这组行为（类似于接口）

```
pub trait Summary {
    fn summarize(&self) -> String; // 只是一个抽象接口，而不具体实现
} // 定义特征

// 为每个需要的类单独实现特征
impl Summary for Post {
    fn summarize(&self) -> String {
        format!("文章{}, 作者是{}", self.title, self.author)
    }
}
impl Summary for Weibo {
    fn summarize(&self) -> String {
        format!("{}发表了微博{}", self.username, self.content)
    }
}
```

**注：**

- 孤儿规则：如果你想要为类型 `A` 实现特征 `T`，那么 `A` **或者** `T` 至少有一个是在当前作用域中定义的（另一个可以在其他库中引入）
- 默认实现：可以在特征中定义具有默认实现的方法，这样其它类型无需再实现该方法，或者也可以选择重载该方法（默认实现允许调用特征中其他方法，哪怕这个方法没有默认实现）



#### **特征约束**

特征作为函数参数：

```
pub fn notify(item: &impl Summary) { // 实现了Summary特征 的 item 参数
    println!("Breaking news! {}", item.summarize());
}
```

语法：

```
pub fn notify<T: Summary>(item: &T) {
    println!("Breaking news! {}", item.summarize());
}
// 对于结构体方法
impl<T: Display> ToString for T {
}
```

形如 `T: Summary` 被称为特征约束

多重约束:

```
// 要求同时实现了两个特征的参数
pub fn notify(item: &(impl Summary + Display)) {}
pub fn notify<T: Summary + Display>(item: &T) {}
```

`where`约束

```
fn some_function<T: Display + Clone, U: Clone + Debug>(t: &T, u: &U) -> i32 {}
fn some_function<T, U>(t: &T, u: &U) -> i32
    where T: Display + Clone,
          U: Clone + Debug
{}
```

函数返回值：

通过 `impl Trait` 来说明一个函数返回了一个类型，该类型实现了某个特征

```
fn returns_summarizable() -> impl Summary { // 返回一个实现了Summary特征的类型
```



#### 特征对象

| 特征约束                         | 特征对象                       |
| -------------------------------- | ------------------------------ |
| `impl Trait`                     | `dyn Trait`                    |
| 接收所有实现了`Trait`的类型      | 接收所有实现了`Trait`的类型    |
| 认为是不一样的类型，不能一起存储 | 认为是相同的类型，可以一起存储 |
| 静态分发，编译时确定             | 动态分发，运行时确定           |

允许你使用 不同类型 但 实现了相同特征 的对象，使它们可以在 同一个变量、参数或返回值 中使用

```
// 语法
&dyn 特征名 // 必须要使用指针，否则无法确定大小
Box<dyn 特征名> // 智能指针

// 动态数组
Vec<Box<dyn 特征名>>
```



### 集合类型

#### 动态数组`Vector`

使用`Vec<T>`表示，只能存储相同类型的数据

```
// 创建数组
let v: Vec<i32> = Vec::new();
let mut v = Vec::new(); // 在添加元素后会自动推导
let mut v: Vec<i32> = Vec::with_capacity(5); // 预先分配空间

let v = vec![1, 2, 3]; // 宏vec!可以给予初始值
let v = vec![0; 3];   // 默认值为 0，初始长度为 3
let v_from = Vec::from([0, 0, 0]);

// 更新（需要为mut）
v.push(n); // 可变引用，不能与其他引用同时存在

// 访问元素
v[下标] //		越界不会检查
v.get(下标) // 返回Option<T>,需要match来解构出值		确保不会越界

// 遍历
for i in &(mut) v {}
    
// 常见方法
v.is_empty()
v.insert(pos, val) // 在指定索引pos处插入数值val
v.remove(pos) // 删除在pos处的数并返回该数
v.pop() // 删除尾部的数并返回(返回的是Option<T>的枚举值)
v.clear()
v.append(&mut v1) // v1所有数据全部转入v，v1被清空

// 排序
sort/sort_unstable() // 默认按照升序类型，且要元素可比较
sort_by/sort_unstable_by(闭包实现) // 可以自定义比较规则来实现多种类型的比较
```

**注：**可以通过使用枚举类型和特征对象来实现不同类型元素的存储

#### `KV`存储`HashMap`

需要使用`use std::collections::HashMap;`来引入

```
// 创建与插入
let mut my_gems = HashMap::new();
my_gems.insert("红宝石", 1);

HashMap::with_capacity(capacity)

let teams_list = vec![
        ("中国队".to_string(), 100),
        ("美国队".to_string(), 10),
        ("日本队".to_string(), 50),
    ];
let teams_map: HashMap<_,_> = teams_list.into_iter().collect(); // 从动态数组转化为hashmap

// 在表中查询元素
let score: Option<&value类型> = 表名.get(key的引用); // 注意返回的是Option<T>类型

// 遍历
for (key, value) in &表名 {
    println!("{}: {}", key, value);
}

// 更新表中的值
let old = scores.insert("Blue", 20); // 会直接覆盖旧值，返回Some(旧值)/None
let v = scores.entry("Yellow").or_insert(5); // 查询Yellow对应的值，若不存在则插入新值；返回存储值的可变引用
```

**注**

`HashMap` 的所有权规则与其它 Rust 类型没有区别：

- 若类型实现 `Copy` 特征，该类型会被复制进 `HashMap`，因此无所谓所有权
- 若没实现 `Copy` 特征，所有权将被转移给 `HashMap` 中（使用引用要确保其生命周期足够长）

### 生命周期

变量的生命周期声明方式：

```
&'a i32     // 具有显式生命周期的引用
&'a mut i32 // 具有显式生命周期的可变引用
```

#### 函数中的生命周期

需要标注生命周期的情况如下：

- 首先返回值必须是引用类型，可能会出现悬垂引用错误
- 存在多个参数时，如果编译器无法确定返回值需要跟随哪个参数的生命周期（哪怕这两个参数的生命周期是一样的），那么不标注就会报错
- 标注之后，编译时就会检查返回值使用会不会超出某个参数，如果发现超出就会报错（标注生命周期实际上**不会更改任何返回值或者变量的真实生命周期**，只是告诉编译器当返回值的生命周期不与较短的参数生命周期一致时，不予通过）

```
// 用'a显式表示生命周期，此处的'a表示两个参数中较短的生命周期，需要提前标注
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {

// 特殊情况：返回值永远只和一个参数有关/返回值与参数无关
fn longest<'a>(x: &'a str, y: &str) -> &'a str { // 只与一个有关就只标注一个
    x
}
fn longest(_x: &str, _y: &str) -> String { // 与新建变量有关尽量不返回引用
    String::from("really long string")
}
```

#### 结构体中的生命周期

如果结构体的字段值类型为引用型，也需要标注生命周期`'a`（`a`可以任意替换）

作用是避免编译器报错、同时(提醒编译器)在编译时就检查其是否不超过原变量的生命周期

```
struct ImportantExcerpt<'a> {
    part: &'a str,
} // 只要在结构体每一个引用标注上生命周期即可，此处也需要提前声明<>
```

#### 生命周期声明消除

为何在只有一个参数时可以不标注生命周期？

存在以下三个步骤可以省略生命周期声明（函数中参数的生命周期是输入生命周期，返回值为输出）：

1. 每一个引用参数都会获得独自的生命周期（所以不声明则多个参数有各自的生命周期声明）

   ```
   fn foo<'a, 'b>(x: &'a i32, y: &'b i32) // 所以不显式标出不知道跟随a还是b
   ```

2. 若只有一个输入生命周期（函数参数中只有一个引用类型），那么该生命周期会被赋给所有的输出生命周期，也就是所有返回值的生命周期都等于该输入生命周期

   ```
   fn foo<'a>(x: &'a i32) -> &'a i32 // 所以单个参数可以省略
   ```

3. 若存在多个输入生命周期，且其中一个是 `&self` 或 `&mut self`，则 `&self` 的生命周期被赋给所有的输出生命周期

#### 方法中的生命周期

- 类似于泛型结构体
- 方法签名中一般不需要标注，因为有`&self`参数（根据以上第三条规则）

```
struct ImportantExcerpt<'a> {
    part: &'a str,
}

impl<'a> ImportantExcerpt<'a> {
    fn level(&self) -> i32 {
        3
    }
}
```

#### 静态生命周期

拥有`'static`生命周期声明的引用生命周期是整个程序

```
let s: &'static str = "我没啥优点，就是活得久，嘿嘿";
```

### 属性

属性是一种元数据，用于修改编译器的行为、提供额外信息或影响代码生成方式

使用`#[]`语法

#### 常见类型

**`#[derive()]`** 自动派生特征

用于让编译器自动为结构体或枚举实现特定的 **trait**（特征），如 `Debug`、`Clone` 等

注意只针对结构体与枚举，同时在实现某特征时（比如`Copy`）结构体中不能够有`String`这种无法自动实现`Copy`的字段

**`#[cfg(...)]`** 条件编译

用于根据特定 条件选择性地编译代码，例如目标平台：

```
#[cfg(target_os = "linux")]
fn platform_specific() {
    println!("Running on Linux!");
} // 只在linux上面编译

#[cfg(feature = "logging")]
fn log_message() {
    println!("Logging is enabled");
} // 启用了feature特征才能编译（feature特征是cargo.toml中定义的）
```

**`#[test]`** Rust 测试函数

用于标记测试函数，让 `cargo test` 自动运行它



### 错误处理

#### `panic`

- 标识不可恢复错误
- 有被动与主动触发两种情况

主动触发：使用`panic!`宏

```
fn main() {
    panic!("crash and burn");
} // 会打印出一个错误信息，展开报错点往前的函数调用堆栈，最后退出程序
```

#### `Result`

标识可恢复的错误

```
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

返回了该枚举类型之后就可以使用`match`来匹配解析

```
 let f = match f {
        Ok(file) => file,
        Err(error) => match error.kind() {
            ErrorKind::NotFound => match File::create("hello.txt") {
                Ok(fc) => fc,
                Err(e) => panic!("Problem creating the file: {:?}", e),
            },
            other_error => panic!("Problem opening the file: {:?}", other_error),
        },
    }; // 一个打开文件的返回处理
```

如果不需要处理错误情况（即要么`Ok()`要么`panic()`，就使用`unwrap()`/`expect`）

```
let f = File::open("hello.txt").unwrap();
// 要么返回正确值要么直接panic

let f = File::open("hello.txt").expect("Failed to open hello.txt");
// 与unwrap()一样，只不过会报出里面的信息

// 改变错误类型：假设有f1(T)返回值T1类型，f2(F)返回值F2类型
let n: u8 = "1".parse().map(f1).map_err(f2) //原本返回T/F,现在返回T1/F1
```

**传播错误**

如果需要上级来处理这个函数中出现的错误呢？

返回`Result<, >`类型

- 使用`match`匹配，用分支来操作/返回
- 使用宏`?`

`?`功能类似于match

```
// match写法
let f = File::open("hello.txt");
let mut f = match f {
    Ok(file) => file,
    Err(e) => return Err(e),
};
let mut s = String::new();
match f.read_to_string(&mut s) {
    Ok(_) => Ok(s),
    Err(e) => Err(e),
}

// ？写法：Err则该函数返回，Ok则语句返回正确值
let mut f = File::open("hello.txt")?;
let mut s = String::new();
f.read_to_string(&mut s)?;
Ok(s)
// ？同时可以进行类型提升，把所有的错误类型都提升为std::error::Error
// 此时就是返回Result<Ok值, Box<dyn std::error::Error>>

// ？可以链式调用
let mut s = String::new();
File::open("hello.txt")?.read_to_string(&mut s)?;
Ok(s)
```

**注：**

- `?`操作符一定需要一个变量来承接正确的值
- 函数一定要是`Result<, >`返回值

#### `Option`与`Result`的转换

```
Option`转`Result`: 使用`.ok_or()`或`.ok_or_else()
// Option<T>	Result<T, E>
let res1: Result<T, E> = Option类型值.ok_or(E类型值);
```

```
Result`转`Option`: 丢弃错误使用`ok()`，丢弃成功值使用`.err()
// Option<T>	Result<T, E>
let opt1: Option<T> = Result类型值.ok();  

// Option<E>	Result<T, E>
let opt1: Option<E> = Result类型值.err(); // 如果Result类型值是ok()则丢弃
```

### 包与模块

```
my_project/
├── Cargo.toml
└── src/
    ├── lib.rs         # library crate (名为 my_project)
    ├── main.rs        # binary crate (名为 my_project)
    └── bin/
        ├── tool1.rs   # binary crate (名为 tool1)
        └── tool2.rs   # binary crate (名为 tool2)
├── tests			   # 集成测试文件
│   └── some_integration_tests.rs
├── benches			   # 基准性能测试文件
│   └── simple_bench.rs
└── examples		   # 项目示例
    └── simple_example.rs
```

```
Package` => `Crate` => `mod
```

#### **`Package(包)`**

一个`Package`就是一个项目，包含一个或多个`Crate`（最多一个）

每个 Package 必须包含一个 `Cargo.toml` 文件来描述包的元信息和依赖

#### **`Crate(单元/箱)`**

- `crate` 是一个 Rust 项目或库的最小单元，即需要一起编译不可继续拆分
- 分为`lib`单元（入口文件一般为`src/lib.rs`；编译为库文件`.rlib`；不可单独执行，可以为其他项目提供依赖）和二进制单元（入口文件一般为`src/main.rs`或者在 `src/bin/` 目录下；编译为可执行文件）
- 一个`Package`最多可以包含一个库单元和多个二进制单元，也可以只包含一个库单元/一个或几个二进制单元
- 对于二进制单元，`src/main.rs`是默认的crate，其他的crate都在`src/bin/`（或其他）目录下，且文件可以单独编译（一个文件就是一个`crate`）

考虑划分多个 crate 当：

1. 部分代码需要作为独立库被其他项目使用
2. 项目包含多个独立可执行工具
3. 某些功能需要单独编译和测试
4. 需要减少编译时间（修改一个 crate 不会导致其他 crate 重新编译）

#### **`Mod(模块)`**

使用模块只是为了更好地组织代码，同时控制它们的可见性

```
// 定义语法
mod A {
	mod B {fn B1(){}} //可以嵌套
	mod C {fn C1(){}}
}

// 路径引用
fn D() {
    // 绝对路径
    crate::A::B::B1(); 
    //相对路径：只能以super/self/模块名或Crate开头
    A::B::B1(); // 在同一个Crate根部的相对路径可以直接这么写
}

// 可见性设置
pub mod hosting { // 模块写pub仅代表其可被访问，而其中的函数等还是对外界不可见
    pub fn add_to_waitlist() {} // 函数也需以pub开头
}
```

- 一个`Crate`是一棵模块树，而`src/main.rs`及`src/lib.rs`就是该树的根
- 模块A包含模块B，则A是B的父模块，B是A的子模块
- 模块中可以定义各种`Rust`类型，如函数、结构体、枚举、特征等
- 在同一个`Crate`根下的模块，相互引用的相对路径可以直接以对方模块名称开头；在同一父模块下的两个子模块，若在同文件中实现则也可以以对方模块名称开头，否则需要通过`super::`来使用父模块中转
- 将结构体设置为 `pub`，但它的所有字段依然是私有的；将枚举设置为 `pub`，它的所有字段也将对外可见
- 可以把模块实现放入对应等级的`*.rs`文件中，`*`要等同于模块名（文件中便不必再写），模块的定义/声明还是在父文件/模块中

#### `use`

```
// 基本引用方式：绝对或相对路径
use crate::front_of_house::hosting; // 引入模块
use front_of_house::hosting::add_to_waitlist; // 引入函数

// as别名
use std::fmt::Result;
use std::io::Result as IoResult;

// 引入再导出
pub use crate::front_of_house::hosting;

// 简化引入
use std::collections::{HashMap,BTreeMap,HashSet};
use std::{cmp::Ordering, io};

use std::io;
use std::io::Write;
use std::io::{self, Write};

use std::collections::*; // 引入模块下所有项
```

**注：**

- 如果引入的函数存在同名的情况时，需使用`模块名::函数名`的方式或者`as`别名的方式来区分

**限制可见性**

- `pub` 意味着可见性无任何限制
- `pub(crate)` 表示在当前包可见
- `pub(self)` 在当前模块可见
- `pub(super)` 在父模块可见
- `pub(in <path>)` 表示在某个路径代表的模块中可见，其中 `path` 必须是父模块或者祖先模块



### 函数式编程

简单来说，迭代器/高阶函数是“流水线模板”，提供规范流程（比如`map\filter`等等）；闭包是“可替换的工具”，即灵活调整传入的参数；而这两者都需要满足“不可变性”的安全要求

#### 闭包

闭包是一种匿名函数，它**可以赋值给变量也可以作为参数传递给其它函数**，不同于函数的是，它**允许捕获调用者作用域中的值**

闭包语法：

```
// 定义闭包
|param1, param2,...| {
    语句1;
    语句2;
    返回表达式
} 
|param1| 返回表达式 // 只需要有一个表达式时
|| {} // 如果不需要参数时

// 结构体中的闭包
struct Cacher<T>
where T: Fn(u32) -> u32,
{
    query: T,
}  // 等价于struct Cacher<T: Fn(u32) -> u32>，query字段同样也可以使用一个符合的函数作为值
```

**注：**

- 闭包函数中是否标注类型皆可（如果未使用过则需要标注），同样可以以此省略返回值
- 闭包函数中的类型不可以是泛型，所以每次使用参数要求同类型

**三种`Fn`特征**

`FnOnce`: 强制需要闭包所捕获变量的所有权

`FnMut`: 用于闭包函数内需要改变被捕获变量的值的情况，需要闭包和捕获变量都有`mut`声明

`Fn`: 以不可变借用的方式捕获环境中的值(与`FnMut`不兼容，即不可改变捕获函数的值)

**注：**

- 在`FnOnce`作为传入闭包的特征约束时，传入闭包和其捕获函数的所有权都会在第一次调用时被消耗；特殊情况：同时要求`FnOnce`与`Copy`（闭包会实现Copy，而其捕获的变量也会尽量实现Copy）

  ```
  fn main() {
      let x = vec![1, 2, 3];
      fn_once(|z|{z == x.len()})
  }
  
  fn fn_once<F>(func: F)
  where
      F: FnOnce(usize) -> bool,
  {
      println!("{}", func(3)); // 捕获的Vec的所有权，闭包与变量一起消耗
      println!("{}", func(4));
  }
  
  fn fn_once<F>(func: F)
  where
      F: FnOnce(usize) -> bool + Copy,// 改动在这里
  {
      println!("{}", func(3)); // 闭包实现Copy，不消耗；尽可能捕获可Copy的值如x.len()，没有则会在编译报错
      println!("{}", func(4));
  }
  ```

- 由上所知，闭包的捕获行为会根据上下文约束来调整

- 闭包自动实现`Copy`特征的规则是，只要闭包捕获的类型都实现了`Copy`特征的话，这个闭包就会默认实现`Copy`特征

- `FnOnce`会消耗闭包的所有权；但无论按值还是按引用传递，`Fn`/`FnMut`通常都不会消耗闭包的所有权。即在传入一个有`Fn(Mut)`特征约束的函数之后，一个闭包函数的变量还可以继续使用

- 所有的闭包都自动实现了 `FnOnce` 特征，因此任何一个闭包都至少可以被调用一次；没有移出所捕获变量的所有权的闭包自动实现了 `FnMut` 特征；不需要对捕获变量进行改变的闭包自动实现了 `Fn` 特征

**`move`**

```
let update_string =  move || println!("{}",s); // move强制闭包获取变量所有权
```

闭包作为函数返回值

```
fn factory() -> Fn(i32) -> i32 {
    let num = 5;
    |x| x + num
} // 报错，特征不是类型，需要其他辅助声明

fn factory(x:i32) -> impl Fn(i32) -> i32 {
    let num = 5;
    if x > 1{
        move |x| x + num
    } else {
        move |x| x - num
    }
} // 报错，返回的内容要求是同一类型，此处虽然满足同一特征，但属于不同类型

fn factory(x:i32) -> Box<dyn Fn(i32) -> i32> {
    let num = 5;
    if x > 1{
        Box::new(move |x| x + num)
    } else {
        Box::new(move |x| x - num)
    }
} // 正确，使用智能指针将其视为同一类型
```

#### 迭代器`Iterator`

迭代器允许我们迭代一个连续的集合，例如数组、动态数组 `Vec`、`HashMap` 等，在此过程中，只需关心集合中的元素如何处理，而无需关心如何开始、如何结束、按照什么样的索引去访问

1、`.next`是迭代器中取下一个值的方式,返回`Option<T>`

```
pub trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
    // 省略其余有默认实现的方法
} // 迭代器实现的特征Interator
```

2、将数组转化为迭代器的三种方式(`Vec`动态数组实现的`IntoIterator`中的函数)：

- `into_iter` 会夺走所有权
- `iter` 是借用
- `iter_mut` 是可变借用（`next`方法返回的`&mut `）

3、迭代器的消费者与适配器（都是迭代器特征中的方法）

- 消费者：消费掉迭代器，返回一个值

   会拿走迭代器的所有权，即调用它之后迭代器无法再使用

- 适配器：返回一个新的迭代器，是链式调用的基础

   因此在链式调用末尾需要一个消费者来收尾用以返回一个值

  ```
  //例1
  let v1: Vec<i32> = vec![1, 2, 3];
  
  let v2: Vec<_> = v1.iter().map(|x| x + 1).collect();
  // collect():消费掉迭代器，把值收集成特定类型（需要显式注明）
  // .map():对迭代器的每一个值操作，换为另一个新值
  
  assert_eq!(v2, vec![2, 3, 4]);
  
  //例2
  let names = ["sunface", "sunfei"];
  let ages = [18, 18];
  let folks: HashMap<_, _> = names.into_iter().zip(ages.into_iter()).collect();
  // .zip():将两个迭代器压缩在一起，形成Iterator<Item=(ValueFromA, ValueFromB)> 这样的新的迭代器
  
  //例3：闭包用作适配器参数
  fn shoes_in_size(shoes: Vec<Shoe>, shoe_size: u32) -> Vec<Shoe> {
      shoes.into_iter().filter(|s| s.size == shoe_size).collect()
  } // filter():对迭代器每个值进行过滤，若满足则保留
  // 此处闭包同样可以捕捉环境变量
  ```

  

### 深入类型



#### 类型转换



**as转换**

```
let a = 3.1 as i8;
let b = 100_i8 as i32;
let c = 'a' as u8; // 将字符'a'转换为整数，97
```

注：

转换不具有传递性：就算 `e as U1 as U2` 是合法的，也不能说明 `e as U2` 是合法的（`e` 不能直接转换成 `U2`）

**`TryInto`转换**

```
let a: u8 = 10;
let b: u16 = 1500;
let b_: u8 = b.try_into().unwrap(); //尝试进行一次转换，并返回一个 Result
```

注：`try_into` 转换会捕获大类型向小类型转换时导致的溢出错误

**`From`和`Into`特征**

- **`From<T>`**：定义如何从类型 `T` 转换到当前类型。
- **`Into<T>`**：自动为实现了 `From` 的类型生成反向转换。

```
impl From<i32> for MyType {
    fn from(value: i32) -> Self {
        MyType(value)
  
    
    }
}

let a = MyType::from(42);  // 显式调用
let b: MyType = 42.into(); // 自动推导（需类型注解）
```

#### `newtype`

使用[元组结构体](https://course.rs/basic/compound-type/struct.html#元组结构体tuple-struct)的方式将已有的类型包裹起来：`struct Meters(u32);`，那么此处 `Meters` 就是一个 `newtype`

- 自定义类型可以让我们给出更有意义和可读性的类型名，例如与其使用 `u32` 作为距离的单位类型，我们可以使用 `Meters`，它的可读性要好得多
- 对于某些场景，只有 `newtype` 可以很好地解决
- 隐藏内部类型的细节

**为外部类型实现外部特征**

孤儿规则：要为类型 `A` 实现特征 `T`，那么 `A` 或者 `T` 必须至少有一个在当前的作用范围内

```
// 例：想为Vec实现Display特征，但这两个都在标准库中
use std::fmt;
struct Wrapper(Vec<String>);
impl fmt::Display for Wrapper {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "[{}]", self.0.join(", "))
    }
}

// 注：包裹一样类型的newtype是不同的类型,newtype与其内部包裹的类型同理
```



#### 类型别名

```
type Meters = u32
```

**注：**类型别名仅仅为了更好的可读性，与原类型没有任何区别

```
// 应用：减少代码模板的使用
let f: Box<dyn Fn() + Send + 'static> = Box::new(|| println!("hi"));

type Thunk = Box<dyn Fn() + Send + 'static>;
let f: Thunk = Box::new(|| println!("hi"));

//常用于简化Result<T, E> 枚举中
type Result<T> = std::result::Result<T, std::io::Error>; // 此处为std::io库中Error类型的简化
```



#### 不定长类型DST

定长类型：基础类型、集合 `Vec`、`String` 和 `HashMap` 等(其在栈上拥有固定大小的指针)

不定长类型：`str`、特征对象

```
fn foobar_1(thing: &dyn MyThing) {}     // OK
fn foobar_2(thing: Box<dyn MyThing>) {} // OK
fn foobar_3(thing: MyThing) {}          // ERROR!
```

**注：**只能间接使用DST，通过引用或`Box`来使用

**`Sized`特征**

怎么保证泛型参数是固定大小的类型？

```
fn generic<T(: Sized)>(t: T) { // 自动补全了Sized特征
}
```

#### 枚举与整数

枚举到整数很容易，但反过来需要借助三方库来实现

```
enum MyEnum {
    A = 1,
    B,
    C,
}
fn main() {
    // 将枚举转换成整数，顺利通过
    let x = MyEnum::C as i32;
    // 将整数转换为枚举，失败
    match x {
        MyEnum::A => {}
        MyEnum::B => {}
        MyEnum::C => {}
        _ => {}
    }
}

// 使用num-traits/num-derive库
use num_derive::FromPrimitive;
use num_traits::FromPrimitive;

match FromPrimitive::from_i32(x) {
    Some(MyEnum::A) => println!("Got A"),
    Some(MyEnum::B) => println!("Got B"),
    Some(MyEnum::C) => println!("Got C"),
    None            => println!("Couldn't convert {}", x),
}
```



### 智能指针

| **特性**       | **引用（`&T`/`&mut T`）**                  | **智能指针（如 `Box<T>`、`Rc<T>`）**            |
| -------------- | ------------------------------------------ | ----------------------------------------------- |
| **所有权关系** | 无所有权，仅是借用                         | 通常拥有数据的所有权                            |
| **可变性控制** | 分为共享引用（`&T`）和可变引用（`&mut T`） | 通过内部可变性（如 `RefCell<T>`）或类型设计实现 |
| **生命周期**   | 必须显式或隐式标注生命周期                 | 通常管理数据的整个生命周期（如 `Box` 负责释放） |
| **动态行为**   | 仅提供访问，无额外逻辑                     | 可附加逻辑（如引用计数、自动释放、线程安全）    |
| **常见类型**   | `&T`, `&mut T`                             | `Box<T>`, `Rc<T>`, `Arc<T>`, `RefCell<T>`       |

智能指针与普通自定义结构体区别：实现了`Deref`和`Drop`特征

智能指针用于一些较引用更复杂的场景

#### `Box<T>`堆对象分配

`Box` 简单的封装，用于将值存储在堆上

使用场景：

- 特意的将数据分配在堆上
- 数据较大时，又不想在转移所有权时进行数据拷贝
- 类型的大小在编译期无法确定，但是我们又需要固定大小的类型时
- 特征对象，用于说明对象实现了一个特征，而不是某个特定的类型

```
// 将数据存储在堆上
let a = 3; // a在栈上
let a = Box::new(3); // 在堆上

// 避免栈上数据拷贝
let arr = [0;1000];
let arr1 = arr; // 此时两份数据，是深拷贝

let arr = Box::new([0;1000]);
let arr1 = arr; // 所有权顺利转移给 arr1，arr 不再拥有所有权

// 提供固定大小
enum List {
    Cons(i32, List), // 递归类型：无法确定大小，因为DST报错
    Nil,
}
enum List {
    Cons(i32, Box<List>),
    Nil,
}

// 特征对象
// 想实现不同类型组成的数组只有两个办法：枚举和特征对象
// 特征对象其实就是把DST类型的特征转为固定大小
```

**另：**`Box::leak`可以真正将一个运行期的值转化为`'static`，如果只标注`'static`可能无法成功

#### `Deref`解引用

```
Deref` 可以让智能指针像引用那样工作，这样你就可以写出同时支持智能指针和引用的代码，例如 `*T
```

**`\*`:** 对常规引用使用`*`操作符，即可以通过解引用的方式获取到内存地址对应的数据值

**智能指针解引用：** 在使用给定的智能指针时，直接使用`*`解引用即可

在智能指针解引用时，实际上调用了`*(y.deref())`方法：`y.deref()`先返回了值的常规引用

```
// 如果要实现自己的智能指针同样要实现Deref特征
use std::ops::Deref;
impl<T> Deref for MyBox<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
} // 实现该特征后才能使用*解引用
```

**函数/方法中的隐式`Deref`转换**

函数和方法的传参中有`Deref`的隐式转换。

若一个类型实现了 `Deref` 特征，那它的引用在传给函数或方法时，会根据参数签名来决定是否进行隐式的 `Deref` 转换(`Deref`支持连续的隐式转换)

**总结**

- 一个类型为 `T` 的对象 `foo`，如果 `T: Deref<Target=U>`，那么，相关 `foo` 的引用 `&foo` 在应用的时候会自动转换为 `&U`
- 在解引用时自动把智能指针和 `&&&&v` 做引用归一化操作，转换成 `&v` 形式，最终再对 `&v` 进行解引用（即将智能指针脱壳为内部的引用类型即`&v`， 把多级引用归一为一级`&v`）

#### `Drop`释放资源

指定在一个变量超出作用域时，执行一段特定的代码，最终编译器将帮你自动插入这段收尾代码（无需在每一个使用该变量的地方，都写一段代码来进行收尾工作和资源释放）

```
impl Drop for Foo {
    fn drop(&mut self) { // 传入的是可变借用
        println!("Dropping Foo!")
    }
}
```

**Drop 的顺序**

- 变量级别，按照逆序的方式（`_x` 在 `_foo` 之前创建，因此 `_x` 在 `_foo` 之后被 `drop`）
- 结构体内部，按照顺序的方式

**注：**

- Rust 自动为几乎所有类型都实现了 `Drop` 特征（除了栈上的简单类型）
- 不允许显式地调用析构函数`变量名.drop()`，但可以调用函数`drop(变量名)`（`drop()`函数会拿走目标值的所有权）
- `Copy`和`Drop`互斥，不会在一种类型上面出现（为了防止重复释放内存）

#### `Rc`

通过引用计数的方式，允许一个数据资源在同一时刻拥有多个所有者

实现机制就是 `Rc` 和 `Arc`，前者适用于单线程，后者适用于多线程

**`Rc<T>`**

引用计数：通过记录一个数据被引用的次数来确定该数据是否正在被使用。当引用次数归零时，就代表该数据不再被使用，因此可以被清理释放

当我们希望在堆上分配一个对象供程序的多个部分使用且无法确定哪个部分最后一个结束时，就可以使用 `Rc` 成为数据值的所有者

```
let a = Rc::new(String::from("hello, world")); // 创建时引用计数+1，此时Rc::strong_count(&a) 返回的值是 1
let b = Rc::clone(&a); // clone 仅仅复制了智能指针并增加了引用计数，并没有克隆底层数据；同样可以使用a.clone()
```

**注：**

- 这几个智能指针都是相同的所以`Rc::strong_count(&a/b/c)`皆可
- 当其中一个变量离开作用域被销毁后，计数`-1`，但只有当计数为0时，这个指针和指向的底层数据才会销毁
- `Rc<T>`指向的是底层数据的不可变应用(相当于有多个不可变引用)
- 实现了`Deref`特征，可以直接使用里面的数值

**`Arc`**

- 原子化的 `Rc<T>` 智能指针,保证我们的数据能够安全的在线程间共享
- 与`Rc`的API完全相同
- `Arc` 和 `Rc` 并没有定义在同一个模块，前者通过 `use std::sync::Arc` 来引入，后者通过 `use std::rc::Rc`

#### `Cell`和`RefCell`

解决问题（相较于引用）：

- 可以通过不可变引用来修改数据
- 绕过编译期借用检查
- 实现了部分可变性（比如标定结构体某个字段为内部可变）

| **操作**       | `Cell<T>`             | `RefCell<T>`                 |
| -------------- | --------------------- | ---------------------------- |
| 获取不可变访问 | `get()` → `T`（复制） | `borrow()` → `Ref<T>`        |
| 获取可变访问   | `set(new_value)`      | `borrow_mut()` → `RefMut<T>` |
| 运行时检查     | 无                    | 有（可能 panic）             |
| 适用类型       | `T: Copy`（如 `i32`） | 任意 `T`（如 `String`）      |

**`Cell`**

`Cell` 和 `RefCell` 在功能上没有区别，区别在于 `Cell<T>` 适用于 `T` 实现 `Copy` 的情况

```
let c = Cell::new(42);
let val = c.get(); // 复制值（42）
c.set(100); // 替换新值，仍然拥有所有权不会报错

let c = Cell::new(String::from("asdf")); // 这样会报错
```

**`RefCell`**

- 允许通过不可变引用 (`&T`) 修改内部数据（内部可变性）。
- 在运行时（而非编译期）检查借用规则，违反规则时触发 `panic`。

```
let s = RefCell::new(String::from("hello, world")); // s为RefCell<T>类型
```

| 方法           | 行为                                                         |
| -------------- | ------------------------------------------------------------ |
| `borrow()`     | 获取不可变引用 (`Ref<T>`)，增加不可变借用计数。若已有可变借用，则 `panic`。 |
| `borrow_mut()` | 获取可变引用 (`RefMut<T>`)，标记独占借用。若已有任何借用，则 `panic`。 |

```
struct Logger {
    logs: RefCell<Vec<String>>, // 内部可变
}

impl Logger {
    fn log(&self, message: &str) {
        // 通过不可变的 &self 修改 logs！
        self.logs.borrow_mut().push(message.to_string());
    }
}
```

**注：**`RefCell` 的核心机制是，将一个本应可变的数据（如 `String`）包裹在“壳子”（`RefCell`）里，然后通过这个壳子的不可变引用（`&RefCell<T>`），在运行时安全地修改内部数据

#### 循环引用与自引用

面临问题：当使用`RefCell<Rc<List>>`时，可以a指向b，b再指向a，出现循环引用，最后`Rc`计数无法归0

**`Weak`**

仅保存一份指向数据的弱引用，不保证引用关系依然存在，无法阻止所引用的内存值被释放

| `Weak`                                          | `Rc`                                      |
| ----------------------------------------------- | ----------------------------------------- |
| 不计数                                          | 引用计数                                  |
| 不拥有所有权                                    | 拥有值的所有权                            |
| 不阻止值被释放(drop)                            | 所有权计数归零，才能 drop                 |
| 引用的值存在返回 `Some`，不存在返回 `None`      | 引用的值必定存在                          |
| 通过 `upgrade` 取到 `Option<Rc<T>>`，然后再取值 | 通过 `Deref` 自动解引用，取值无需任何操作 |

`Weak` 通过 `use std::rc::Weak` 来引入，它具有以下特点:

- 可访问，但没有所有权，不增加引用计数，因此不会影响被引用值的释放回收
- 可由 `Rc<T>` 调用 `Rc::downgrade` 方法转换成 `Weak<T>`
- `Weak<T>` 可使用 `upgrade` 方法转换成 `Option<Rc<T>>`，如果资源已经被释放，则 `Option` 的值是 `None`
- 常用于解决循环引用的问题

### 多线程并发编程

并发：同时存在多个动作

并行：可以同时执行多个动作

关系：并发程序可以由人编写，但只有有多个CPU内核时才可以并行执行；

 并行一定并发，但只有多核时并发才能够并行

#### 使用线程

**风险**

由于多线程的代码是同时运行的，因此我们无法保证线程间的执行顺序，这会导致一些问题：

- 竞态条件(race conditions)，多个线程以非一致性的顺序同时访问数据资源
- 死锁(deadlocks)，两个线程都想使用某个资源，但是又都在等待对方释放资源后才能使用，结果最终都无法继续执行
- 一些因为多线程导致的很隐晦的 BUG，难以复现和解决

**创建线程：**`thread::spawn`

```
use std::thread;
use std::time::Duration;

fn main() {
    let handle = 
    thread::spawn(|| {
        for i in 1..10 {
            println!("hi number {} from the spawned thread!", i);
            thread::sleep(Duration::from_millis(1)); // thread::sleep 会让当前线程休眠指定的时间，随后其它线程会被调度运行
        }
    }); // 线程内部的代码使用闭包来执行
    
    handle.join().unwrap(); // 让当前线程阻塞，直到它等待的子线程的结束
    
    for i in 1..5 {
        println!("hi number {} from the main thread!", i);
        thread::sleep(Duration::from_millis(1));
    }
} // main 线程一旦结束，程序就立刻结束，因此需要保持它的存活，直到其它子线程完成自己的任务
```

**注：**

- 线程的启动结束时间点都是不固定的
- 由上一条，为了保证子线程中的变量一直有效，在子线程的闭包中捕获了环境变量时，需要使用`move`来转移所有权
- 主线程（`main`）退出时，会强制终止所有子线程（无论它们是否在运行）；父线程（非主线程）退出时，不会影响它创建的子线程
- `thread::spawn` 的返回值是**`std::thread::JoinHandle`**类型，表示对线程的控制权，允许主线程通过 `join()` 等待子线程结束，同样可以使用数组收集

**多线程的性能**

当任务是 CPU 密集型时，就算线程数超过了 CPU 核心数，也并不能帮你获得更好的性能

当你的任务大部分时间都处于阻塞状态时，就可以考虑增多线程数量（典型就是网络 IO 操作）

**线程屏障`Barrier`**

让多个线程都执行到某个点后，才继续一起往后执行

```
use std::sync::{Arc, Barrier};
use std::thread;

fn main() {
    let barrier = Arc::new(Barrier::new(3));
    let mut handles = vec![];

    for i in 0..3 {
        let barrier = barrier.clone();
        handles.push(thread::spawn(move || {
            println!("线程 {}: 阶段1", i);
            barrier.wait(); // 等待所有线程完成阶段1
            println!("线程 {}: 阶段2", i);
        }));
    }

    for handle in handles {
        handle.join().unwrap();
    }
}
```

**注：**

- 需要`Arc`智能指针，作用是允许多个线程同时拥有同一数据（跨线程`Rc`）
- `Barrier::new(n)`中的`n`值一定要与实际调用`wait()`的线程数相等

**多线程局部变量**

标准库`thread_local`

```
// 定义
thread_local! {
    static MY_TLS: 类型 = 初始化值; // 必须使用static声明为全局变量，一般使用RefCell/Cell/Mutex包裹
}

// 语法：变量名.with(|绑定名| { 操作 }); 闭包传入参数即为局部变量
thread::spawn(|| {
    // 每个线程独立操作 COUNTER
    COUNTER.with(|c| {
          *c.borrow_mut() += 1;
          println!("Thread {:?}: {}", thread::current().id(), c.borrow());
});
```

**注：**如果想使用多个局部变量的闭包函数，使用嵌套

 同样还有使用`use thread_local::ThreadLocal;`引用的三方库，这个库不仅仅使用了值的拷贝，而且还能自动把多个拷贝汇总到一个迭代器中，最后进行求和

条件控制线程的挂起和执行：`let pair = Arc::new((Mutex::new(false), Condvar::new()));`

只会调用一次的函数：`static INIT: Once =Once::new();`

```
INIT.call_once(|| {unsafe {VAL = 2;}});
```

#### 线程同步

##### **消息传递**

线程通过发送和接收消息来通信，而非直接共享内存

**标准库工具`mpsc`**，允许多发送者，单接收者

```
use std::sync::mpsc;

// 创建一个消息通道, 返回一个元组：(发送者，接收者)
let (tx, rx) = mpsc::channel();

// 创建线程，并发送消息
thread::spawn(move || {
    tx.send(1).unwrap(); // 发送一个数字1, send方法返回Result<T,E>，通过unwrap进行快速错误处理

    // 下面代码将报错，因为编译器自动推导出通道传递的值是i32类型，那么Option<i32>类型将产生不匹配错误
    // tx.send(Some(1)).unwrap()
});

// 在主线程中接收子线程发送的消息并输出
println!("receive {}", rx.recv().unwrap());

// 尝试接收一次消息，不会阻塞线程，当通道中没有消息时，它会立刻返回一个错误
println!("receive {:?}", rx.try_recv());


// 连续接收消息
thread::spawn(move || {
    let vals = vec![
        String::from("hi"),
        String::from("from"),
        String::from("the"),
        String::from("thread"),
    ];
    for val in vals {
        tx.send(val).unwrap();
        thread::sleep(Duration::from_secs(1));
    }
});

for received in rx {
    println!("Got: {}", received);
}

// 使用多发送者：克隆发送者，其余的线程拿走拷贝
let tx1 = tx.clone();
thread::spawn(move || {
    tx1.send(String::from("hi from cloned tx")).unwrap();
}); 
for received in rx {
    println!("Got: {}", received);
}// 需要所有的发送者都被drop掉后，接收者rx才会收到错误，进而跳出for循环，最终结束主线程；
// 两个子线程谁先创建完成是未知的，哪条消息先发送也是未知的

// 同步通道设置
let (tx, rx)= mpsc::sync_channel(n); // n用来指定同步通道的消息缓存条数
```

- `tx`,`rx`对应发送者和接收者，它们的类型由编译器自动推导: `tx.send(1)`发送了整数，因此它们分别是`mpsc::Sender<i32>`和`mpsc::Receiver<i32>`类型，(一旦类型被推导确定，该通道就只能传递对应类型的值)
- 接收消息的操作`rx.recv()`会阻塞当前线程，直到读取到值，或者通道被关闭
- 需要使用`move`将`tx`的所有权转移到子线程的闭包中
- 使用通道来传输数据，一样要遵循 Rust 的所有权规则：
  - 若值的类型实现了`Copy`特征，则直接复制一份该值，然后传输过去，例如之前的`i32`类型
  - 若值没有实现`Copy`（如`String`类型），则它的所有权会被转移给接收端，在发送端继续使用该值将报错
- 异步中只有接收者会被阻塞，同步中发送者也会因为接收者接收不到消息被阻塞
- 所有发送者被`drop`或者所有接收者被`drop`后，通道会自动关闭

##### 锁、`Condvar`

使用共享内存来实现同步性

面临问题：多个线程同时修改同一数据时，结果不可预测；线程执行顺序影响最终结果

**互斥锁`Mutex`**

同一时间，只允许一个线程`A`访问该值，其它线程需要等待`A`访问完成后才能继续

```
// 创建实例：锁的容器
let m = Mutex::new(5);
{
    // lock返回的是Result
    let mut num = m.lock().unwrap(); // .lock()向m申请锁的所有权（简称“锁”）：在获取锁之前会阻塞线程。同时只能有一个线程获得锁
    // 当拥有锁的线程panic，其他线程永远得不到这个锁
    *num = 6;
    // 锁自动被drop
}

// 多线程中使用锁
use std::sync::{Arc, Mutex};
use std::thread;

let counter = Arc::new(Mutex::new(0));
let mut handles = vec![];

for _ in 0..10 {
    let counter = Arc::clone(&counter);
    // 创建子线程，并将`Mutex`的所有权拷贝传入到子线程中，子线程需要通过move拿走锁的所有权
    let handle = thread::spawn(move || {
        let mut num = counter.lock().unwrap();
		*num += 1;
    });
    handles.push(handle);
}
// 等待所有子线程完成
for handle in handles {
    handle.join().unwrap();
}
```

- `m.lock()`返回一个智能指针`MutexGuard<T>`，拥有`Deref`特征（自动解引用获取引用类型）与`Drop`特征（超出作用域自动释放锁）
- `Rc<T>/RefCell<T>`用于单线程内部可变性， `Arc<T>/Mutex<T>`用于多线程内部可变性

**死锁**

- 在另一个锁还未被释放时去申请新的锁，就会触发
- 当我们拥有两个锁的容器，且两个线程各自使用了其中一个锁，然后试图去访问另一个锁时，就可能发生死锁
- `try_lock()`: 尝试去获取一次锁，如果无法获取会返回一个错误，因此不会发生阻塞

```
let guard = MUTEX2.lock().unwrap();
let guard = MUTEX2.try_lock(); // 返回错误
```

**读写锁`RwLock`**

```
Mutex`会对每次读写都进行加锁，但某些时候，我们需要大量的并发读，`Mutex`就无法满足需求了，此时就可以使用`RwLock
use std::sync::RwLock;

fn main() {
    let lock = RwLock::new(5);

    // 同一时间允许多个读
    {
        let r1 = lock.read().unwrap();
        let r2 = lock.read().unwrap();
        assert_eq!(*r1, 5);
        assert_eq!(*r2, 5);
    } // 读锁在此处被drop

    // 同一时间只允许一个写
    {
        let mut w = lock.write().unwrap();
        *w += 1;
        assert_eq!(*w, 6);

        // 以下代码会阻塞发生死锁，因为读和写不允许同时存在
        // 写锁w直到该语句块结束才被释放，因此下面的读锁依然处于`w`的作用域中
        // let r1 = lock.read();
        // println!("{:?}",r1);
    }// 写锁在此处被drop
}
```

我们也可以使用`try_write`和`try_read`来尝试进行一次写/读，若失败则返回错误

```
Err("WouldBlock")
```

**条件变量`Condvar`控制线程同步**

```
use std::sync::{Arc, Mutex, Condvar};

let pair = Arc::new((Mutex::new(false), Condvar::new()));
let (lock, cvar) = &*pair;

// 消费者线程（等待条件成立）
let consumer = thread::spawn(move || {
    let mut condition = lock.lock().unwrap();
    while !*condition {
        condition = cvar.wait(condition).unwrap(); // 释放锁并等待
    }
    println!("Condition is now true!");
});

// 生产者线程（修改条件并通知）
thread::spawn(move || {
    let mut condition = lock.lock().unwrap();
    *condition = true;          // 修改条件
    cvar.notify_one();          // 唤醒消费者
});

consumer.join().unwrap();
```

消费者线程需等待条件成立才可执行：获取互斥锁检查条件是否成立 => 不成立则进入循环 => `cvar.wait(condition).unwrap()`执行时立即释放互斥锁（交由其他线程修改） => 其他线程修改后使用`cvar.notify_one()`唤醒该线程 => 返回条件重新检查

注：

- ```
  notify_one()
  ```

   随机唤醒一个正在

  ```
  wait()
  ```

  的线程（由操作系统调度决定）。

  - 如果有多个线程在等待，不保证顺序（可能是最早等待的，也可能是随机的）。
  - 如果没有线程在等待，这次通知会被丢弃（无效果）。

- `notify_all()`： 唤醒所有正在 `wait()` 的线程，它们会竞争锁并依次检查条件。

##### `Atomic`原子类型与内存顺序

为解决锁的性能问题而生，通过 CPU 的原子指令实现无锁线程安全操作

| 特性             | 说明                                                         |
| ---------------- | ------------------------------------------------------------ |
| **不可分割性**   | 操作一旦开始，不会被其他线程或 CPU 中断。                    |
| **线程安全**     | 多线程同时执行同一原子指令时，结果依然正确                   |
| **硬件直接支持** | 由 CPU 通过特定指令（如 `LOCK` 前缀）实现，而非软件模拟。    |
| **内存顺序控制** | 通过 `Ordering` 参数指定操作前后的指令重排规则（如 `SeqCst`）。 |

```
use std::sync::atomic::AtomicUsize;

let counter = AtomicUsize::new(0); // 常用场景是作为全局变量

counter.store(100, Ordering::Relaxed); // 存储值（写入）

let current = counter.load(Ordering::SeqCst);
println!("Current value: {}", current); // 加载值（读取）

let old = counter.fetch_add(10, Ordering::SeqCst); // 原子加法（返回旧值）旧值=100，新值=110

counter.fetch_sub(5, Ordering::Relaxed); // 原子减法 新值=105

counter.fetch_or(0b1, Ordering::Relaxed); // 原子位操作 按位或
```

**内存顺序**

面临问题：编译器可能导致指令重排

```
X = 1;
Y = 3;
X = 2; // 直接变成

X = 2;
Y = 3;
```

内存顺序指定

| **Ordering** | 作用                                                         |
| ------------ | ------------------------------------------------------------ |
| `Relaxed`    | 仅保证原子性，不保证顺序（性能最高）                         |
| `Release`    | 写入操作：确保之前的指令不会被重排到它之后，（在这条指令前写入的数据）对其他线程可见 |
| `Acquire`    | 读取操作：确保之后的指令不会被重排到它之前，能读到其他线程的修改 |
| `SeqCst`     | 严格顺序一致性（性能最低，但最安全）                         |

```
use std::sync::atomic::{AtomicBool, Ordering};

let ready = AtomicBool::new(false);
let data = 42;

// 线程1：发布数据
thread::spawn(move || {
    data = 100;                        // 非原子写入
    ready.store(true, Ordering::Release); // 保证 data 写入对其他线程可见
});

// 线程2：读取数据
thread::spawn(move || {
    while !ready.load(Ordering::Acquire) {} // 等待并同步内存
    println!("Data: {}", data);        // 保证看到 data=100
});

// 多线程需要用到Arc与clone
```



### 全局变量

全局变量的生命周期肯定是`'static`，但是不代表它需要用`static`来声明

- 编译期初始化的全局变量，`const`创建常量，`static`创建静态变量，`Atomic`创建原子类型
- 运行期初始化的全局变量，`lazy_static`用于懒初始化，`Box::leak`利用内存泄漏将一个变量的生命周期变为`'static`

#### 编译期初始化



**静态常量**

```
const MAX_ID: usize =  usize::MAX / 2;
```

- 关键字是`const`而不是`let`
- 定义常量必须指明类型（如 i32）不能省略
- 定义常量时变量的命名规则一般是全部大写
- 常量可以在任意作用域进行定义，其生命周期贯穿整个程序的生命周期。编译时编译器会尽可能将其内联到代码中，所以在不同地方对同一常量的引用并不能保证引用到相同的内存地址
- 常量的赋值只能是常量表达式/数学表达式，也就是说必须是在编译期就能计算出的值，如果需要在运行时才能得出结果的值比如函数，则不能赋值给常量表达式
- 对于变量出现重复的定义(绑定)会发生变量遮盖，后面定义的变量会遮住前面定义的变量，常量则不允许出现重复的定义

**静态变量**

```
static mut REQUEST_RECV: usize = 0;
```

- 必须使用`unsafe`语句块才能访问和修改`static`变量
- 定义静态变量的时候必须赋值为在编译期就可以计算出的值(常量表达式/数学表达式)，不能是运行时才能计算出的值(如函数)

**原子类型**

想要全局计数器、状态控制等功能，又想要线程安全的实现

```
use std::sync::atomic::{AtomicUsize, Ordering};
static REQUEST_RECV: AtomicUsize  = AtomicUsize::new(0);
```



#### 运行期初始化

解决问题：无法用函数进行静态初始化

**`lazy_static`**

用于懒初始化（直到使用时才开始初始化）静态变量的宏，允许我们在运行期初始化静态变量

```
use lazy_static::lazy_static;
lazy_static! {
    static ref NAMES: Mutex<String> = Mutex::new(String::from("Sunface, Jack, Allen"));
}
```

`lazy_static`宏，匹配的是`static ref`，所以定义的静态变量都是不可变引用

**`Box::leak`**

将一个变量从内存中漏出来，变为`'static'`生命周期

```
#[derive(Debug)]
struct Config {
    a: String,
    b: String
}
static mut CONFIG: Option<&mut Config> = None;

fn main() {
    let c = Box::new(Config {
        a: "A".to_string(),
        b: "B".to_string(),
    });

    unsafe {
        // 将`c`从内存中泄漏，变成`'static`生命周期(正常情况下，一个局部变量不可赋给全局变量)
        CONFIG = Some(Box::leak(c));
        println!("{:?}", CONFIG);
    }
}
```



### 错误处理

#### 组合器

**`or()`和`and()`**

对两个表达式做逻辑组合，最终返回 `Option` / `Result`

- `or()`，表达式按照顺序求值，若任何一个表达式的结果是 `Some` 或 `Ok`，则该值会立刻返回
- `and()`，若两个表达式的结果都是 `Some` 或 `Ok`，则第二个表达式中的值被返回。若任何一个的结果是 `None` 或 `Err` ，则立刻返回。

```
let s1 = Some("some1");
let s2 = Some("some2");
let n: Option<&str> = None;
assert_eq!(s1.or(s2), s1);
```

注：`or/and()`的两个表达式要是同一类型，不能一边是`Option`一边是`Result`

**`or_else()和and_then()`**

跟 `or()` 和 `and()` 类似，但第二个表达式是一个闭包

```
let s1 = Some("some1");
let fn_some = || Some("some2");
let fn_none = || None;
assert_eq!(s1.or_else(fn_some), s1);
```

**`fliter`**

用于对 `Option` 进行过滤

```
let s1 = Some(3);
let n = None;
let fn_is_even = |x: &i8| x % 2 == 0;
assert_eq!(s1.filter(fn_is_even), n);
```

**`map()`和`map_err()`**

`map` 可以将 `Some` 或 `Ok` 中的值映射为另一个（转化容器内的值）

 如果`a`的值是`Some(n)`，`a.map(f)`将`a`的值变为`Some(f(n))`

用 `map_err`将 `Err` 中的值进行改变（效果同上）

```
let s1 = Some("abcde");
let s2 = Some(5);
let fn_character_count = |s: &str| s.chars().count();
assert_eq!(s1.map(fn_character_count), s2);

let e1: Result<&str, &str> = Err("404");
let e2: Result<&str, isize> = Err(404);
let fn_character_count = |s: &str| -> isize { s.parse().unwrap() };
assert_eq!(e1.map_err(fn_character_count), e2);
```



**`map_or()`和`map_or_else()`**

`map_or` 在 `map` 的基础上提供了一个默认值

`map_or_else` 与 `map_or` 类似，但是它是通过一个闭包来提供默认值

```
const V_DEFAULT: u32 = 1; // 默认值
let s: Result<u32, ()> = Ok(10);
let fn_closure = |v: u32| v + 2;
assert_eq!(s.map_or(V_DEFAULT, fn_closure), 12);

let s = Some(10);
let fn_closure = |v: i8| v + 2;
let fn_default = || 1; // 默认值
assert_eq!(s.map_or_else(fn_default, fn_closure), 12);
```

**`ok_or()`和`ok_or_else`**

可以将 `Option` 类型转换为 `Result` 类型

`ok_or` 接收一个默认的 `Err` 参数，`ok_or_else` 接收一个闭包作为 `Err` 参数

```
const ERR_DEFAULT: &str = "error message";
// let fn_err_message = || "error message";

assert_eq!(s.ok_or(ERR_DEFAULT), o); // Some(T) -> Ok(T)
assert_eq!(n.ok_or(ERR_DEFAULT), e); // None -> Err(default)
```



#### 自定义错误类型

```
use std::fmt::{Debug, Display};

pub trait Error: Debug + Display {
    fn source(&self) -> Option<&(Error + 'static)> { ... }
}
```

当自定义类型实现该特征后，该类型就可以作为 `Err` 来使用，同时可以归一化为`Box<dyn std::error:Error>`

**将其他错误类型转化为自定义错误类型**

只要实现`From`特征，即可使用`?`强制把返回的错误类型转换（同时返回）

```
// std::convert::From特征
pub trait From<T>: Sized {
  fn from(_: T) -> Self;
} // T为原本的错误类型
```

**归一化不同错误类型**

面临问题：要在一个函数中返回不同的错误

解决方案：将不同的错误类型归一化为一种

- 使用特征对象 `Box<dyn Error>`：需要实现`Debug + Display` 特征（存在问题：一个没有`Error`特征的类型同样可以用作`Result<T, E>`中的`E`）
- 自定义错误类型：需要实现`Error`特征才能被转换出来
- 使用 `thiserror`（一种三方库函数）

### `UnSafe`

面临问题：

- 编译器过强且保守
- 特定功能如底层硬件操作本就不安全

`unsafe`功能

- 解引用裸指针
- 调用一个 `unsafe` 或外部的函数
- 访问或修改一个可变的静态变量
- 实现一个 `unsafe` 特征
- 访问 `union` 中的字段

#### 功能解析

##### 解引用裸指针

裸指针在功能上跟引用类似，同时它也需要显式地注明可变性。

`*const T` 和 `*mut T`分别代表了不可变和可变（`*` 是类型名称的一部分而非解引用）

裸指针的功能（类似于C的指针）：

- 可以绕过 Rust 的借用规则，可以同时拥有一个数据的可变、不可变指针，甚至还能拥有多个可变的指针
- 并不能保证指向合法的内存
- 可以是 `null`
- 没有实现任何自动的回收 (drop)

```
// 基于引用创建裸指针
let mut num = 5;
let r1 = &num as *const i32; 
let r2 = &mut num as *mut i32;

// 使用*解引用
unsafe {
    println!("{}", *r1);
}

// 基于智能指针创建裸指针
let a: Box<i32> = Box::new(10);
let b: *const i32 = &*a; // 需要先解引用a
let c: *const i32 = Box::into_raw(a); // 使用 into_raw 来创建
```

注：

- 创建裸指针是安全的行为，使用不是
- 使用裸指针可以创建两个可变指针都指向同一个数据（需要自己处理数据竞争）

##### 调用`unsafe`函数或方法

```
// unsafe函数：外表唯一不同就是需要unsafe fn来定义，在调用时需要放在unsafe块
// 在unsafe函数中使用unsafe来注明块是多余的行为
unsafe fn dangerous() {}
fn main() {
    unsafe {
    	dangerous();
	}
}

// 在函数中使用了unsafe声明块不代表函数要声明为unsafe fn:同样可以使用用安全的抽象包裹unsafr代码
```

##### `FFI`

用来与其它语言进行交互

面临问题：使用一个其他语言编写的库

- 对该库进行重写或者移植
- 使用 `FFI`

```
// 调用C标准库中的abs函数
extern "C" { // C定义了外部函数所使用的应用二进制接口ABI
    fn abs(input: i32) -> i32;
}
fn main() {
    unsafe { // 必须使用unsafe
        println!("Absolute value of -3 according to C: {}", abs(-3));
    }
}
```

##### 访问`union`中的字段

`union`主要用于和`C`代码交互，访问其字段是不安全的

```
#[repr(C)]
union MyUnion {
    f1: u32,
    f2: f32,
}
```



### `Macro`宏编程

宏的参数可以使用 `()`、`[]` 以及 `{}`：虽然三种使用形式皆可，但是 Rust 内置的宏都有自己约定俗成的使用方式，例如 `vec![...]`、`assert_eq!(...)` 等

宏分为两类：

- 声明式宏
- 三种过程宏
  - `#[derive]`，在之前多次见到的派生宏，可以为目标结构体或枚举派生指定的代码，例如 `Debug` 特征
  - 类属性宏(Attribute-like macro)，用于为目标添加自定义的属性
  - 类函数宏(Function-like macro)，看上去就像是函数调用

#### 宏与函数的区别

元编程：通过一种代码来生成另一种代码，可以帮我们减少所需编写的代码，也可以一定程度上减少维护的成本

可变参数：相比于`Rust`中函数参数个数的固定，宏的参数个数可变

宏展开：宏展开过程是发生在编译器对代码进行解释之前，即编译期前；函数直到运行时才调用

#### 声明式宏`macro_rules`

声明式宏用来编写可以生成代码的代码，即可以编写自己的宏

类似于`match`进行模式匹配，类似于函数可以传入参数

```
// 基本形式
macro_rules! macro_name {
    (pattern) => { expansion };
    // 可以有多个匹配模式
}
```

**模式匹配**的模式可以包括：字面量、元变量（以 `$` 开头的捕获，如 `$x:expr`）、重复（使用 `$(...)*` 或 `$(...)+` 等表示重复）

**元变量类型**（类似于函数定义中形参的类型声明）

- `expr`：表达式
- `ident`：标识符（变量名、函数名等）
- `ty`：类型
- `path`：路径（如 `std::collections::HashMap`）
- `pat`：模式
- `stmt`：语句
- `block`：代码块
- `item`：项（函数、结构体、模块等）
- `meta`：元项（`#[...]` 和 `#![...]` 属性内部的内容）
- `tt`：标记树（单个标记或括号内的标记）

**重复操作符**

- `*`：0 次或多次
- `+`：1 次或多次
- `?`：0 次或 1 次

```
#[macro_export] // 将宏进行了导出，其它的包就可以将该宏引入到当前作用域中
macro_rules! create_function { // 宏的名称是c_f，在调用时才需要加上！
    ($func_name:ident) => {
        fn $func_name() {
            println!("You called {}", stringify!($func_name));
        }
    };
}
// 使用
create_function!(foo); // 传入一个合法标识符，创建了一个函数
foo(); // 输出: You called foo

// 重复模式
#[macro_export]
macro_rules! vec {
    ( $( $x:expr ),* ) => {
        {
            let mut temp_vec = Vec::new();
            $(
                temp_vec.push($x);
            )* // 此处相当于一个循环
            temp_vec
        }
    };
}
// 使用
let v = vec!("a", "b", "c");
```



#### 过程宏

1. **派生宏（Derive Macros）** *"自动为结构体/枚举生成 trait 实现的代码扩展器。"* → **用途**：如 `#[derive(Serialize)]` 为类型实现序列化逻辑。
2. **属性宏（Attribute Macros）** *"编译时代码加工器，能修改或增强被标记的项（如函数/结构体）。"* → **用途**：如 `#[tokio::main]` 将普通函数异步化。
3. **函数式宏（Function-like Macros）** *"将其他语法编译时转换为 Rust 代码的翻译器。"* → **用途**：如 `sql!(SELECT * FROM table)` 生成类型安全的查询构建器。

##### 自定义`derive`过程宏

注：目前只能在单独的包中定义宏，包名以`derive`为后缀

假设有一个特征 `HelloMacro`，现在有两种方式让用户使用它：

- 为每个类型手动实现该特征，就像之前特征章节所做的
- 使用过程宏来统一实现该特征，这样用户只需要对类型进行标记即可：`#[derive(HelloMacro)]`

```
// hello_macro项目目录
hello_macro
├── Cargo.toml
├── src
│   ├── main.rs
│   └── lib.rs
└── hello_macro_derive // 此包中实现宏
    ├── Cargo.toml
    ├── src
        └── lib.rs
```

在项目的`src/main.rs`中引用宏包中的内容：

- 将 `hello_macro_derive` 发布到 `crates.io` 或 `GitHub` 中（类似于正常的依赖）
- 使用相对路径引入的本地化方式

```
// 修改 hello_macro/Cargo.toml 文件添加以下内容
[dependencies]
hello_macro_derive = { path = "../hello_macro/hello_macro_derive" }
# 也可以使用下面的相对路径
# hello_macro_derive = { path = "./hello_macro_derive" }
```

定义过程宏的过程

```
// 1、在 hello_macro_derive/Cargo.toml 文件中添加
[lib]
proc-macro = true

[dependencies]
syn = "1.0"
quote = "1.0" // 这两个依赖包是定义中必须的

// 2、在 hello_macro_derive/src/lib.rs 中添加
extern crate proc_macro; // 过程宏核心库，提供 TokenStream 类型（表示宏的输入/输出）
use proc_macro::TokenStream;
use quote::quote;
use syn;
use syn::DeriveInput;

#[proc_macro_derive(HelloMacro)]
pub fn hello_macro_derive(input: TokenStream) -> TokenStream {
    // 基于 input 构建 AST 语法树
    let ast:DeriveInput = syn::parse(input).unwrap();

    // 构建特征实现代码
    impl_hello_macro(&ast)
}
```





# RCore学习记录

顺序：`bulid.rs`文件会生成一个`link_app.S`（里面包含有各个程序标识起始地址的变量、名称和完整的ELF文件嵌入），这个文件由`linker.S`塞入内核镜像（编译链接后的程序文件），最后由`load`来执行

任务切换的实质：切换任务上下文（即更改对应的寄存器为想执行的任务上下文中保存的数值）



### 批处理系统

**系统调用的基础函数：**

`syscall` （用户文件中，标准库函数的基础） 和`sbicall` （系统文件中）

```rust
 3fn syscall(id: usize, args: [usize; 3]) -> isize {
 4   let mut ret: isize;
 5   unsafe {
 6       core::arch::asm!(
 7           "ecall",
 8           inlateout("x10") args[0] => ret,
 9           in("x11") args[1],
10           in("x12") args[2],
11           in("x17") id
12       );
13   }
14   ret
15}
```



**批处理系统的应用管理器：**

（从系统文件中一个记录了应用数量、各应用起始位置、最后一个应用结束位置的`link_app.S`中获取）

```rust
struct AppManager {
    num_app: usize,
    current_app: usize,
    app_start: [usize; MAX_APP_NUM + 1],
}
```

方法： `print_app_info/get_current_app/move_to_next_app` 

`load_app`将参数 `app_id` 对应的应用程序的二进制镜像加载到物理内存以 `0x80400000` 起始的位置



**`batch`子模块暴露的接口**

- `init` ：初始化 `APP_MANAGER` 
- `run_next_app` ：加载并运行下一个应用程序



**用户栈与内核栈**

```rust
 1// os/src/batch.rs
 2
 3#[repr(align(4096))]
 4struct KernelStack {
 5  data: [u8; KERNEL_STACK_SIZE],
 6}
 7
 8#[repr(align(4096))]
 9struct UserStack {
10  data: [u8; USER_STACK_SIZE],
11}
12
13static KERNEL_STACK: KernelStack = KernelStack {
14  data: [0; KERNEL_STACK_SIZE],
15};
16static USER_STACK: UserStack = UserStack {
17  data: [0; USER_STACK_SIZE],
18};
```

实现了 `get_sp` 方法来获取栈顶地址



**特权级切换**

| CSR 名    | 该 CSR 与 Trap 相关的功能                                    |
| --------- | ------------------------------------------------------------ |
| `sstatus` | `SPP` 等字段给出 Trap 发生之前 CPU 处在哪个特权级（S/U）等信息 |
| `sepc`    | 当 Trap 是一个异常的时候，记录 Trap 发生之前执行的最后一条指令的地址 |
| `scause`  | 描述 Trap 的原因                                             |
| `stval`   | 给出 Trap 附加信息                                           |
| `stvec`   | 控制 Trap 处理代码的入口地址                                 |

硬件自动完成：

- `sstatus` 的 `SPP` 字段会被修改为 CPU 当前的特权级（U/S）。
- `sepc` 会被修改为 Trap 处理完成后默认会执行的下一条指令的地址。
- `scause/stval` 分别会被修改成这次 Trap 的原因以及相关的附加信息。
- CPU 会跳转到 `stvec` 所设置的 Trap 处理入口地址，并将当前特权级设置为 S ，然后从Trap 处理入口地址处开始执行。

处理完成后通过S特权级`sret`指令：

- CPU 会将当前的特权级按照 `sstatus` 的 `SPP` 字段设置为 U 或者 S ；
- CPU 会跳转到 `sepc` 寄存器指向的那条指令，然后继续执行。



**`Trap`上下文**

```rust
1// os/src/trap/context.rs
2
3#[repr(C)]
4pub struct TrapContext {
5    pub x: [usize; 32],
6    pub sstatus: Sstatus,
7    pub sepc: usize,
8} // 包含所有的通用寄存器 `x0~x31` ，还有 `sstatus` 和 `sepc`
// 从内存栈底分配34个空间保存
```

实现 Trap 上下文保存和恢复的汇编代码`os/src/trap/trap.S`,用（汇编中的）外部符号 `__alltraps` 和 `__restore` 标记为函数

Trap 处理的总体流程如下：首先通过 `__alltraps` 将 Trap 上下文保存在内核栈上，然后跳转到使用 Rust 编写的 `trap_handler` 函数 完成 Trap 分发及处理。当 `trap_handler` 返回之后，使用 `__restore` 从保存在内核栈上的 Trap 上下文恢复寄存器。最后通过一条 `sret` 指令回到应用程序执行

使用`sp`表示当前的栈，`sscratch`代表另一个栈

方法：

```rust
impl TrapContext {
    pub fn set_sp(&mut self, sp: usize) 
    pub fn app_init_context(entry: usize, sp: usize) -> Self 
    // 修改其中的 sepc 寄存器为应用程序入口点 entry， sp 寄存器为我们设定的 一个栈指针，并将 sstatus 寄存器的 SPP 字段设置为 User
}
```





### 分时多任务

`user/build.py`为每个应用定制各自的起始地址，.text 段的地址为 `0x80400000 + app_id * 0x20000`



`batch` 被拆分为 `loader` 和 `task` ， 前者负责启动时加载应用程序，后者负责切换和调度。

`loader` 模块的 `load_apps` 函数负责将所有用户程序在内核初始化的时一并加载进内存



**任务切换**

当一个应用在内核态时，其 Trap 控制流可以调用一个特殊的 `__switch` 函数，函数调用时运行另一个任务，返回后运行原来的任务

在 `__switch` 中保存 CPU 的某些寄存器，它们就是任务上下文

函数拥有两个参数：

```rust
 __switch(
    current_task_cx_ptr: *mut TaskContext,
    next_task_cx_ptr: *const TaskContext
)
```

内核先把 `current_task_cx_ptr` 中包含的寄存器值逐个保存，再把 `next_task_cx_ptr` 中包含的寄存器值逐个恢复

```rust
1// os/src/task/context.rs
2#[repr(C)]
3pub struct TaskContext {
4    ra: usize, // 任务恢复后执行地址
5    sp: usize, // 该任务内核栈地址(当前是内核态)
6    s: [usize; 12], // 被调用者保存寄存器
7} // TaskContext 里包含的寄存器
```



**管理多道程序**

- 任务运行状态：未初始化、准备执行、正在执行、已退出
- 任务控制块：维护任务状态和任务上下文
- 任务相关系统调用：程序主动暂停 `sys_yield` 和主动退出 `sys_exit`

```rust
pub enum TaskStatus { // 任务状态
    UnInit, // 未初始化
    Ready, // 准备运行
    Running, // 正在运行
    Exited, // 已退出
}

pub struct TaskControlBlock { // 任务控制块
    pub task_status: TaskStatus, // 任务状态
    pub task_cx: TaskContext, // 任务上下文
}
```

全局的任务管理器

```rust
pub struct TaskManager {
    num_app: usize,
    inner: UPSafeCell<TaskManagerInner>,
}

struct TaskManagerInner {
    tasks: [TaskControlBlock; MAX_APP_NUM],
    current_task: usize,
}
```

`TaskManager`方法：`mark_current_suspended`（暂停当前程序）/  `mark_current_exited` / `run_next_task` / `find_next_task`（找到下一个`Ready`状态的应用）



**时钟中断**

处理器维护时钟计数器 `mtime`，还有另外一个 CSR `mtimecmp` 。 一旦计数器 `mtime` 的值超过了 `mtimecmp`，就会触发一次时钟中断

```rust
pub fn get_time() -> usize { // 获得mtime值
    time::read()
}

pub fn set_timer(timer: usize) {
    sbi_call(SBI_SET_TIMER, timer, 0, 0);
}
pub fn set_next_trigger() { // 设置时钟中断
    set_timer(get_time() + CLOCK_FREQ / TICKS_PER_SEC);
}
```





### 页表机制

非叶节点（页目录表，非末级页表）的表项标志位含义和叶节点（页表，末级页表）相比有一些不同：

- 当 `V` 为 0 的时候，代表当前指针是一个空指针，无法走向下一级节点，即该页表项对应的虚拟地址范围是无效的；
- 只有当 `V` 为1 且 `R/W/X` 均为 0 时，表示是一个合法的页目录表项，其包含的指针会指向下一级的页表；
- 注意: 当 `V` 为1 且 `R/W/X` 不全为 0 时，表示是一个合法的页表项，其包含了虚地址对应的物理页号。

**物理地址与物理页号转换**

```rust
 3impl PhysAddr {
 4    pub fn page_offset(&self) -> usize { self.0 & (PAGE_SIZE - 1) } // 从自己的物理地址0x12345000得到偏移为0x000（末三位）
 5}
 6
 7impl From<PhysAddr> for PhysPageNum {
 8    fn from(v: PhysAddr) -> Self {
 9        assert_eq!(v.page_offset(), 0);
10        v.floor()
11    } // 只有偏移为0（即对齐）才能从0x12345000得到物理页号0x12345
12}
13
14impl From<PhysPageNum> for PhysAddr {
15    fn from(v: PhysPageNum) -> Self { Self(v.0 << PAGE_SIZE_BITS) }
16} // 从物理页号0x12345还原回物理地址0x12345000
```

**页表项的数据结构抽象与类型定义**

页表项共8个字节：

- V(0)	仅当 V(Valid) 位为 1 时，页表项才是合法的；
- R(1)/W(2)/X(3)	R/W/X 分别控制索引到这个页表项的对应虚拟页面是否允许读/写/取指；
- U(4)	U 控制索引到这个页表项的对应虚拟页面是否在 CPU 处于 U 特权级的情况下是否被允许访问；
- G(5)	G 我们不理会；
- A(6)	A(Accessed) 记录自从页表项上的这一位被清零之后，页表项的对应虚拟页面是否被访问过；
- D(7)	D(Dirty) 则记录自从页表项上的这一位被清零之后，页表项的对应虚拟页表是否被修改过。
- RSW(8-9)	
- PPN[0] (10-18)	
- PPN[1] (19-27)	
- PPN[2] (28-53)	
- Reserved(54-63)	

前八位的实现：

```rust
bitflags! { // 用来表示比特位的宏
    pub struct PTEFlags: u8 {
        const V = 1 << 0;
        const R = 1 << 1;
        const W = 1 << 2;
        const X = 1 << 3;
        const U = 1 << 4;
        const G = 1 << 5;
        const A = 1 << 6;
        const D = 1 << 7;
    }
}
```

结构体的实现与方法：

```rust
 3#[derive(Copy, Clone)]
 4#[repr(C)]
 5pub struct PageTableEntry { // 一个页表项
 6    pub bits: usize,
 7}
 8
 9impl PageTableEntry {
10    pub fn new(ppn: PhysPageNum, flags: PTEFlags) -> Self {
11        PageTableEntry {
12            bits: ppn.0 << 10 | flags.bits as usize,
13        }
14    }
15    pub fn empty() -> Self {
16        PageTableEntry {
17            bits: 0,
18        }
19    }
20    pub fn ppn(&self) -> PhysPageNum {
22    }
23    pub fn flags(&self) -> PTEFlags {
25    }
     pub fn is_valid(&self) -> bool {
    }
26}
```



**页帧管理器**

```rust
pub struct StackFrameAllocator {
    current: usize,
    end: usize,
    recycled: Vec<usize>,
}
// 方法
fn alloc(&mut self) -> Option<PhysPageNum> // 分配物理页
fn dealloc(&mut self, ppn: PhysPageNum) // 回收物理页

// 用以调用的接口
pub fn frame_alloc() -> Option<FrameTracker>
fn frame_dealloc(ppn: PhysPageNum)

// 代表一个物理页帧
pub struct FrameTracker {
    pub ppn: PhysPageNum,
}
impl FrameTracker {
    pub fn new(ppn: PhysPageNum) -> Self {
		// 将这个物理页帧上的所有字节清零
    }
    fn drop(&mut self) {
        frame_dealloc(self.ppn);
    }
}
```



**多级页表**

正常情况可以依靠MMU直接翻译，手动翻译是由于操作系统是不能直接靠MMU来访问用户地址程序的

```rust
// 一个应用所有的页表
pub struct PageTable {
    root_ppn: PhysPageNum, // 某应用的根节点物理页号
    frames: Vec<FrameTracker>, // 页表中所有节点（包括根）的物理页帧，不包括叶节点指向的
}
impl PageTable {
    pub fn new() -> Self { // 新建时只需要分配一个根节点
    }
}

// 页表：维护虚拟物理地址的映射
// 方法
impl PageTable {
    pub fn map(&mut self, vpn: VirtPageNum, ppn: PhysPageNum, flags: PTEFlags);
    pub fn unmap(&mut self, vpn: VirtPageNum);
}
```

访问特定物理页帧

```rust
impl PhysPageNum {
    pub fn get_pte_array(&self) -> &'static mut [PageTableEntry] {
    } // 返回的是一个页表项定长数组的可变引用
    pub fn get_bytes_array(&self) -> &'static mut [u8] {
    } //  返回的是一个字节数组的可变引用
    pub fn get_mut<T>(&self) -> &'static mut T {
    } // 获取一个恰好放在一个物理页帧开头的类型为 T 的数据的可变引用
}
```

建立/拆除虚实地址映射

```rust
impl VirtPageNum {
    pub fn indexes(&self) -> [usize; 3] { // 返回虚拟页号的三级索引
    }
}

impl PageTable {
   fn find_pte_create(&mut self, vpn: VirtPageNum) -> Option<&mut PageTableEntry>  // 给定虚拟页号，找到/创建页表项及中间层页表
} // 注意，这个只返回最后一级的页表项，所以还要通过map/unmap来判断或创建最后的物理地址
```

只查询，不建立

```rust
impl PageTable {
    pub fn from_token(satp: usize) -> Self {} // 从satp寄存器中读此时的根页表地址
    fn find_pte(&self, vpn: VirtPageNum) -> Option<&PageTableEntry> {} // 查找对应的页表是否存在（没有也不新建）
    pub fn translate(&self, vpn: VirtPageNum) -> Option<PageTableEntry> {} // 如果存放就返回
}

// 用户虚拟地址 => 可写物理内存
pub fn translated_byte_buffer(token: usize, ptr: *const u8, len: usize) -> Vec<&'static mut [u8]> {}
```



**地址空间抽象**

逻辑段：虚拟地址连续，虚拟地址映射到物理地址的方式相同（物理页帧具有的属性相同而非物理地址连续）

```rust
// 逻辑段结构体
pub struct MapArea {
    vpn_range: VPNRange, // 一段虚拟页号的连续区间，是一个迭代器
    data_frames: BTreeMap<VirtPageNum, FrameTracker>, // 绑定生命周期，到期自动回收
    map_type: MapType,
    map_perm: MapPermission,
}
pub enum MapType { // 逻辑段内虚拟页面映射的方式
    Identical, // 恒等映射
    Framed, // 分配物理页帧（随机）
}
bitflags! { // 该逻辑段的访问方式
    pub struct MapPermission: u8 {
        const R = 1 << 1;
        const W = 1 << 2;
        const X = 1 << 3;
        const U = 1 << 4;
    }
}

// 方法
impl MapArea {
    pub fn new( start_va: VirtAddr, end_va: VirtAddr, map_type: MapType, map_perm: MapPermission ) -> Self {};
    pub fn map_one(&mut self, page_table: &mut PageTable, vpn: VirtPageNum) {}; // 在确定了虚拟页号之后，先在逻辑的页表管理MapArea里面加入虚拟页号和StackFrameAllocator分配的物理页帧，然后在pagetable里完善各级页表里面的指向路径
    pub fn unmap_one(&mut self, page_table: &mut PageTable, vpn: VirtPageNum) {};
    pub fn map(&mut self, page_table: &mut PageTable) {} // 把当前结构体中的所有虚拟地址挨个map_one物理地址
    pub fn unmap(&mut self, page_table: &mut PageTable) {}
    pub fn copy_data(&mut self, page_table: &PageTable, data: &[u8]) {} // 复制data到逻辑段开头
}
```

地址空间：一个进程能够访问的所有内存地址的集合，通常被组织为多个逻辑段

`pagetable`	实际上查找虚拟/物理地址映射的方法（存储各级节点，可以手动搜索），供CPU/MMU使用

`areas`	逻辑上管理的方法（管理虚拟内存、映射数组来直接寻找）

```rust
// 某个地址空间的结构体
pub struct MemorySet { // PageTable 下挂着所有多级页表的节点所在的物理页帧，而每个 MapArea 下则挂着对应逻辑段中的数据所在的物理页帧，这两部分合在一起构成了一个地址空间所需的所有物理页帧（绑定，自动回收）
    page_table: PageTable,
    areas: Vec<MapArea>,
}
// 方法
impl MemorySet {
    pub fn new_bare() -> Self 
    fn push(&mut self, mut map_area: MapArea, data: Option<&[u8]>) // 插入新的逻辑段，还可以在物理页帧上写入data
	pub fn insert_framed_area( &mut self, start_va: VirtAddr, end_va: VirtAddr, permission: MapPermission )  // 新建并插入一段Framed方式映射的逻辑段
    pub fn new_kernel() -> Self; // 生成内核的地址空间
    pub fn from_elf(elf_data: &[u8]) -> (Self, usize, usize); // 分析应用的ELF文件(并且根据这个文件建立新的地址空间，返回栈顶和执行入口)
    pub fn activate(&self) {} // 第一次使用会开启分页，并且进入当前地址空间的页表
    fn map_trampoline(&mut self) {} // 直接插入一个空间地址中最高位置到跳板的键值对（注：所有地址空间中的跳板都是指向trap.S文件）
}
```

**内核的地址空间排布**	

跳板、各应用的内核栈（栈间有空洞区域防溢出）

四个逻辑段`.text/.rodata/.data/.bss`（恒等映射）、恒等映射（除之前内核已使用）所有物理页帧的页表 （即是内核页表）（注：后面两项都是恒等映射建立的三级页表`MapArea`）

**应用程序的地址空间排布**	

跳板、`trap`上下文（用户不可访问）

用户栈、保护页`guard page`、各逻辑段

```rust
// 批处理系统升级：加载应用进入内存
pub fn get_num_app() -> usize {} // 获取程序数量
pub fn get_app_data(app_id: usize) -> &'static [u8] {} // 获得某个应用的全部数据
```



**基于空间地址的分时多任务**

```rust
KERNEL_SPACE: Arc<UPSafeCell<MemorySet>> // 内核地址全局实例

pub struct TrapContext { // trap上下文
    pub x: [usize; 32],
    pub sstatus: Sstatus,
    pub sepc: usize,
    // 以下为新增字段，在初始化时写入，便于保存完成寄存器后切换
    pub kernel_satp: usize,
    pub kernel_sp: usize, // 本来sp指向用户栈，sscratch指向内核栈，交换后在内核栈中保存上下文；但现在由于要更新页表寄存器不够，sscratch指向用户空间中trap上下文处保存，然后根据保存的内存栈顶直接更改sp
    pub trap_handler: usize,
}

 3impl TrapContext {
 4    pub fn set_sp(&mut self, sp: usize) { }
 5    pub fn app_init_context( entry: usize, sp: usize, kernel_satp: usize, kernel_sp: usize, trap_handler: usize ) -> Self {} // 从任务上下文中初始化trap上下文
}
```

**注：**跳板就是执行`trap`时保存上下文的汇编代码`_alltraps`和`_restore`，由于其在内核与应用地址空间的位置相同，所以无论哪种页表都可以在同一位置访问

```rust
// 任务上下文
pub struct TaskControlBlock {
    pub task_status: TaskStatus,
    pub task_cx: TaskContext,
    pub memory_set: MemorySet, // 应用地址空间
    pub trap_cx_ppn: PhysPageNum, // 应用trap上下文的实际物理页帧
    pub base_size: usize, // 应用地址空间大小
}

impl TaskControlBlock {
    pub fn new(elf_data: &[u8], app_id: usize) -> Self {}
    pub fn get_trap_cx(&self) -> &'static mut TrapContext {}
}

// 全局应用管理器
struct TaskManagerInner {
    tasks: Vec<TaskControlBlock>,
    current_task: usize,
}

lazy_static! {
    pub static ref TASK_MANAGER: TaskManager = {}; // 初始化时根据loader提供的app数量和ELF文件来初始化所有任务上下文
}
```





### 进程

新增系统调用

```rust
/// 功能：当前进程 fork 出来一个子进程。
/// 返回值：对于子进程返回 0，对于当前进程则返回子进程的 PID 。
/// syscall ID：220
pub fn sys_fork() -> isize;

/// 功能：当前进程等待一个子进程变为僵尸进程，回收其全部资源并收集其返回值。
/// 参数：pid 表示要等待的子进程的进程 ID，如果为 -1 的话表示等待任意一个子进程；
/// exit_code 表示保存子进程返回值的地址，如果这个地址为 0 的话表示不必保存。
/// 返回值：如果要等待的子进程不存在则返回 -1；否则如果要等待的子进程均未结束则返回 -2；
/// 否则返回结束的子进程的进程 ID。
/// syscall ID：260
pub fn sys_waitpid(pid: isize, exit_code: *mut i32) -> isize;

/// 功能：将当前进程的地址空间清空并加载一个特定的可执行文件，返回用户态后开始它的执行。
/// 参数：path 给出了要加载的可执行文件的名字；
/// 返回值：如果出错的话（如找不到名字相符的可执行文件）则返回 -1，否则不应该返回。
/// syscall ID：221
pub fn sys_exec(path: &str) -> isize;

/// 功能：从文件中读取一段内容到缓冲区。
/// 参数：fd 是待读取文件的文件描述符，切片 buffer 则给出缓冲区。
/// 返回值：如果出现了错误则返回 -1，否则返回实际读到的字节数。
/// syscall ID：63
pub fn sys_read(fd: usize, buffer: &mut [u8]) -> isize;
```

在用户级中，在最最开始（即在`main`函数中）会初始化一个`initproc`用户初始进程，

其只会初始化一个`shell`进程，之后就持续循环+时间片轮转来回收进程（注：所有父进程被回收的进程都会变成其子进程）



```rust
// 基于应用名的应用加载器
static ref APP_NAMES: Vec<&'static str>

pub fn get_app_data_by_name(name: &str) -> Option<&'static [u8]> // 根据名字查找ELF数据
```



进程标识符

```rust
// 进程标识符PID
pub struct PidHandle(pub usize);
impl Drop for PidHandle {
    fn drop(&mut self) { // 自动回收
        PID_ALLOCATOR.exclusive_access().dealloc(self.0);
    }
}

// 进程分配器，类似于FrameAllocator
struct PidAllocator {
    current: usize, // 当前已分配到多少
    recycled: Vec<usize>,
}
impl PidAllocator {
    pub fn new() -> Self { // current为0，数组为空
    }
    pub fn alloc(&mut self) -> PidHandle { // 分配一个新的PIDHandle(其他啥也没有)，优先从回收中选取
    }
    pub fn dealloc(&mut self, pid: usize) { // 在PID已分配、未回收的情况下丢进回收
    }
}
static ref PID_ALLOCATOR : UPSafeCell<PidAllocator> // 实例化
```



内核栈

原本每个程序一个，固定大小按程序顺序排列，中间穿插守护页防止溢出

现在将应用编号替换为进程标识符`PTD`，在内核栈中保存

```rust
pub struct KernelStack {
    pid: usize,
}

impl KernelStack {
    pub fn new(pid_handle: &PidHandle) -> Self { // 为一个已分配的进程标识符生成内核栈
    }
    pub fn push_on_top<T>(&self, value: T) -> *mut T where
        T: Sized, { // 将一个类型为 T 的变量压入内核栈顶并返回其裸指针
    }
    pub fn get_top(&self) -> usize { // 获取当前内核栈顶在内核地址空间中的地址
    }
}
impl Drop for KernelStack {
    fn drop(&mut self) {
    }
}

pub fn kernel_stack_position(app_id: usize) -> (usize, usize) {
 // 得到pid进程内核栈的起始/终止虚拟地址
}
```



**进程控制块**

之前的`TaskControlBlock`分离为

`Processor`处理器管理结构：管理CPU正在运行的任务

`TaskManager`任务管理器：管理未在运行的所有任务

```rust
pub struct TaskControlBlock { // 不可变
    // 不可变
    pub pid: PidHandle,
    pub kernel_stack: KernelStack,
    // 可变
    inner: UPSafeCell<TaskControlBlockInner>,
}
impl TaskControlBlock {
    pub fn inner_exclusive_access(&self) -> RefMut<'_, TaskControlBlockInner> { // 内层 TaskControlBlockInner 的可变引用
        self.inner.exclusive_access() 
    }
    pub fn getpid(&self) -> usize {
        self.pid.0
    }
    pub fn new(elf_data: &[u8]) -> Self {...} // 仅用于内核中手动创建唯一一个初始进程 initproc
    pub fn exec(&self, elf_data: &[u8]) {...}
    pub fn fork(self: &Arc<TaskControlBlock>) -> Arc<TaskControlBlock> {...}
}

pub struct TaskControlBlockInner {
    pub trap_cx_ppn: PhysPageNum, // 应用地址空间中的 Trap 上下文被放在的物理页帧的物理页号
    pub base_size: usize, // 应用数据仅有可能出现在应用地址空间低于 base_size 字节的区域中
    pub task_cx: TaskContext, // 暂停的任务的任务上下文
    pub task_status: TaskStatus, // 当前进程的执行状态
    pub memory_set: MemorySet, // 应用地址空间
    pub parent: Option<Weak<TaskControlBlock>>, // Arc的非拥有引用，可访问但不拥有
    pub children: Vec<Arc<TaskControlBlock>>, // 多个Arc拥有一个不可变值，计数为0时才释放
    pub exit_code: i32,
}
impl TaskControlBlockInner {
    pub fn get_trap_cx(&self) -> &'static mut TrapContext {
        self.trap_cx_ppn.get_mut()
    }
    pub fn get_user_token(&self) -> usize {
        self.memory_set.token()
    }
    fn get_status(&self) -> TaskStatus {
        self.task_status
    }
    pub fn is_zombie(&self) -> bool {
        self.get_status() == TaskStatus::Zombie
    }
}
```

任务管理器与处理器管理器

```rust
// 任务管理器
pub struct TaskManager {
    ready_queue: VecDeque<Arc<TaskControlBlock>>, // 双端队列
}
impl TaskManager {
    pub fn new() -> Self { // 新建一个空任务表
    }
    pub fn add(&mut self, task: Arc<TaskControlBlock>) { // 在末尾新增一个任务
    }
    pub fn fetch(&mut self) -> Option<Arc<TaskControlBlock>> { // 从开头拿取一个任务
    }
}

// 处理器管理结构
pub struct Processor {
    current: Option<Arc<TaskControlBlock>>,
    idle_task_cx: TaskContext, // 当前处理器上的 idle 控制流的任务上下文（调度器上下文）
}
impl Processor {
    pub fn new() -> Self { // 初始化为None
    }
    pub fn take_current(&mut self) -> Option<Arc<TaskControlBlock>> {
    } // 取出当前正在执行的任务
    pub fn current(&self) -> Option<Arc<TaskControlBlock>> {
    } // 返回当前执行的任务的一份拷贝，可以用于获得token/trap_cx等等
    fn get_idle_task_cx_ptr(&mut self) -> *mut TaskContext {
    } // 获取当前处理器上的 idle 控制流的任务上下文指针
}
pub static ref PROCESSOR: UPSafeCell<Processor> // 单核只创建一个

// 进程转换
pub fn run_tasks() { // 负责在taskManager中获取要执行的任务并执行
} // 持续循环，只要进程让出CPU回到调度器中
pub fn schedule(switched_task_cx_ptr: *mut TaskContext) {
} // 在进程交出控制权后，用于回到run_tasks()执行循环中的函数
```

注：

- 将`Processer`的任务上下文分离并且单独存储，是为了把调度和存储分离开，并无其他意义
- `Processer`由内核中的结构体和上下文组成，相当于一个没有进程控制块的进程来用于调度



**进程机制实现**

- 创建初始进程：创建第一个用户态进程 `initproc`；
- 进程调度机制：当进程主动调用 `sys_yield` 交出 CPU 使用权或者内核把本轮分配的时间片用尽的进程换出且换入下一个进程；
- 进程生成机制：进程相关的两个重要系统调用 `sys_fork/sys_exec` 的实现；
- 进程资源回收机制：当进程调用 `sys_exit` 正常退出或者出错被内核终止之后如何保存其退出码，其父进程通过 `sys_waitpid` 系统调用收集该进程的信息并回收其资源。
- 字符输入机制：为了支持shell程序-user_shell获得字符输入，介绍 `sys_read` 系统调用的实现；

```rust
// 创建初始进程
pub static ref INITPROC: Arc<TaskControlBlock> // 懒加载全局的initproc进程控制块
pub fn add_initproc() { // 在taskManager中加入initproc
}

// 进程调度机制
pub fn suspend_current_and_run_next() {
} // Process::取出当前执行的任务，修改状态为Ready后放入taskmanager末尾；然后schedule触发调度并切换任务

// 进程生成机制
impl MapArea {
    pub fn from_another(another: &MapArea) -> Self { // 创建一模一样的结构体
    }
}
impl MemorySet {
    pub fn from_existed_user(user_space: &MemorySet) -> MemorySet {
    } // 创建一模一样的结构体，并且物理地址按页复制数据
}
impl TaskControlBlock {
    pub fn fork(self: &Arc<TaskControlBlock>) -> Arc<TaskControlBlock> {
    } // 与new类似，不过不是从ELF中获取信息而是从memory_set复制后获取
}
pub fn sys_fork() -> isize {
} // 完全复制任务控制块，但是物理页帧不能直接复制，而且新的线程trap_cx中的a[0]（返回值寄存器）要改成0

impl TaskControlBlock {
    pub fn exec(&self, elf_data: &[u8]) {
    } // 从一个ELF文件中获得Memory全部当前memory_set，然后更改控制块中信息
}
pub fn translated_str(token: usize, ptr: *const u8) -> String {
} // 传递给调用的只有要执行的应用的名称字符串的起始地址，要以此在内存中查询得到整个字符串
pub fn sys_exec(path: *const u8) -> isize {
}

// 进程退出机制
pub fn sys_exit(exit_code: i32) -> ! {
} // 调用exit_current_and_run_next()
pub fn exit_current_and_run_next(exit_code: i32) {
} 

pub fn sys_waitpid(pid: isize, exit_code_ptr: *mut i32) -> isize {
} // 等待某个子进程退出，返回它的 pid，并把它的退出码写到指定地址
pub fn wait(exit_code: &mut i32) -> isize {
} // 调用sys_waitpid，成功则返回退出码；失败（返回-2）则yield继续等待
```

在执行`exit_current_and_run_next(exit_code: i32)`时

- 修改当前进程控制块的状态为`TaskStatus::Zombie` 即僵尸进程
- 将退出码传入控制块等待父进程收集
- 将所有子进程挂载在`initproc`下面
- 对当前进程早期回收（回收`Memory_set`中的`areas`即数据页，不回收`pagetable`即页表页）



**user_shell读入机制**

```rust
pub fn sys_read(fd: usize, buf: *const u8, len: usize) -> isize {
} // 仅支持从标准输入 FD_STDIN 即文件描述符 0 读入，且单次读入的长度限制为 1
```







### 文件系统

**文件与文件描述符**

```rust
// 文件接口：只要实现了这个接口，就是文件
pub trait File : Send + Sync {
    fn readable(&self) -> bool;
    fn writable(&self) -> bool;
    fn read(&self, buf: UserBuffer) -> usize;
    fn write(&self, buf: UserBuffer) -> usize;
}
```

用户缓冲区：用户进程在系统调用的时候传给内核的地址空间（以内核为中转，用户缓冲区 <=> 文件）

```rust
pub fn translated_byte_buffer(token: usize, ptr: *const u8, len: usize) -> Vec<&'static mut [u8]>;

pub struct UserBuffer { // 将t_b_b中的切片进一步包装，即几页数据的数组
    pub buffers: Vec<&'static mut [u8]>,
}
impl UserBuffer {
    pub fn new(buffers: Vec<&'static mut [u8]>) -> Self { // 传入数据来新建缓冲区
    }
    pub fn len(&self) -> usize { // 获得总字节数
    }
}
```

标准输入/输出

```rust
pub struct Stdin;
impl File for Stdin {
	fn readable(&self) -> bool { true }
    fn writable(&self) -> bool { false }
    fn read(&self, mut user_buf: UserBuffer) -> usize {
    } // 缓冲区只能为一个字节大小，循环读取标准输入中的char，读取到则跳出循环写入缓冲区，未读取到则挂起继续循环，返回1 
    fn write(&self, _user_buf: UserBuffer) -> usize { 
    } // 直接panic
}

pub struct Stdout;
impl File for Stdout {
    fn readable(&self) -> bool { false }
    fn writable(&self) -> bool { true }
    fn read(&self, _user_buf: UserBuffer) -> usize{
    } // 直接panic
    fn write(&self, user_buf: UserBuffer) -> usize {
    } // 缓冲区无大小限制，读出数据并print!,返回缓冲区字节数
}
```

文件描述符：（文件描述符首先是一个非负整数）对于某一个进程，代表了其打开的一个文件对象，在要对文件进行操作时传入该整数即可（由内核来分配和记录，因为所有文件都在内核中）

文件描述符表：每个进程都有，记录所有其打开且可读写的文件集合（可以以表的下标作为描述符）

```rust
pub struct TaskControlBlockInner {
	……
    pub fd_table: Vec<Option<Arc<dyn File + Send + Sync>>>,
}
impl TaskControlBlock {
    pub fn new(elf_data: &[u8]) -> Self {
    } // 建立新的TCB时要创建三个fd_table: 
    // vec！[Some(Arc::new(Stdin)),Some(Arc::new(Stdout)),Some(Arc::new(Stdout))] 0，1，2
}
```

此处的数据结构：

- `Vec` 无需设置一个固定的文件描述符数量上限；

- `Option` 区分一个文件描述符当前是否空闲：当它是 `None` 的时候是空闲的，而 `Some` 则代表它已被占用；

- `Arc` 提供了共享引用能力：可能会有多个进程共享同一个文件对它进行读写；

  	被它包裹的内容会被放到内核堆而不是栈上，不需要在编译期有确定的大小

- `dyn` 关键字表明 `Arc` 里面的类型实现了 `File/Send/Sync` 三个 Trait ，

  	编译期无法知道它具体是哪个类型需要等到运行时才能知道它的具体类型。

```rust
pub fn sys_write(fd: usize, buf: *const u8, len: usize) -> isize {
}
pub fn sys_read(fd: usize, buf: *const u8, len: usize) -> isize {
}
// 加锁使用write/read访问当前进程符表中标识符（下标）为fd的文件，返回值为w/r的返回值
```



**文件系统接口**

```rust
// 打开/读写的系统调用
fn sys_openat(dirfd: usize, path: &str, flags: u32, mode: u32) -> isize 
// 打开文件并返回描述符，否则返回-1；dirfd/mode无视；path为文件名；flags描述打开文件的标志
bitflags! {
    pub struct OpenFlags: u32 {
        const RDONLY = 0; // 只读
        const WRONLY = 1 << 0; // 只写
        const RDWR = 1 << 1; // 可读写
        const CREATE = 1 << 9; // 在找不到时允许创建
        const TRUNC = 1 << 10; // 打开时清空文件并将大小归零
    }
}
```





**简易文件系统**

- `easy-fs` 是简易文件系统的本体
- `easy-fs-fuse` 是能在开发环境（如 Ubuntu）中运行的应用程序，用于将应用打包为 easy-fs 格式的文件系统镜像，也可以用来对 `easy-fs` 进行测试



文件系统层次化（共分为五层，上层可以调用下层的接口）：

1、磁盘块设备接口层：以块为单位对磁盘块设备进行读写的 trait 接口

```rust
pub trait BlockDevice : Send + Sync + Any {
    fn read_block(&self, block_id: usize, buf: &mut [u8]); // 将编号为 block_id 的块从磁盘读入内存中的缓冲区 buf
    fn write_block(&self, block_id: usize, buf: &[u8]); // 将内存中的缓冲区 buf 中的数据写入磁盘编号为 block_id 的块
} // 以实现了该特征的结构体为磁盘外设的模拟，在实现该特征时写入真正对硬件的操作
```

2、块缓存层：在内存中缓存磁盘块的数据，避免频繁读写磁盘

```rust
// 块缓存
pub const BLOCK_SZ: usize = 512;
pub struct BlockCache {
    cache: [u8; BLOCK_SZ], // 512字节数组，内存中的缓冲区
    block_id: usize, // 这个块的编号
    block_device: Arc<dyn BlockDevice>, // 块所属的底层设备
    modified: bool, // 从磁盘进入内存后是否被修改
}
impl BlockCache {
    pub fn new(block_id: usize, block_device: Arc<dyn BlockDevice>) -> Self {
    } // 新建时从某个磁盘中读入一个块
}
impl BlockCache {
    fn addr_of_offset(&self, offset: usize) -> usize {
    } // 获得cache中偏移量offset的地址
    pub fn get_ref<T>(&self, offset: usize) -> &T where T: Sized {
    } // 获取缓冲区中偏移量为offset的一个T类型值的不可变引用
    pub fn get_mut<T>(&mut self, offset: usize) -> &mut T where T: Sized {
    } // 获取可变引用
    pub fn read<T, V>(&self, offset: usize, f: impl FnOnce(&T) -> V) -> V {
    } // 把闭包函数传入这个函数，在这个函数里面调用闭包直接返回其返回值，unsafe的T指针就不会给出去
    pub fn modify<T, V>(&mut self, offset:usize, f: impl FnOnce(&mut T) -> V) -> V {
    }
    fn drop(&mut self) {
    } // 缓冲区被回收，由modified决定是否写回磁盘
}

// 块缓存全局管理器：一个磁盘拥有一个
pub struct BlockCacheManager {
    queue: VecDeque<(usize, Arc<Mutex<BlockCache>>)>, // 共享引用&互斥访问 磁盘块编号&块缓存
}
impl BlockCacheManager {
    pub fn get_block_cache(&mut self,block_id: usize,block_device: Arc<dyn BlockDevice>,) -> Arc<Mutex<BlockCache>> {
    } // 如果这里存储了block_id的块则返回其副本，没找到且队列未满则新建并插入返回，已满则丢出去未被使用（引用计数为1）的第一个块然后插入返回，否则panic
}
```

3、磁盘数据结构层：磁盘上的超级块、位图、索引节点、数据块、目录项等核心数据结构和相关处理

easy-fs 磁盘按照块编号从小到大顺序分成 5 个连续区域：

- 第一个区域只包括一个块，它是超级块，用于定位其他连续区域的位置，检查文件系统合法性
- 第二个区域是一个索引节点位图，长度为若干个块：记录索引节点区域中有哪些索引节点已经被分配出去使用了(每个`bit`表示一个节点)
- 第三个区域是索引节点区域，长度为若干个块，其中的每个块都存储了若干个索引节点（每个节点描述一个“文件”/“目录”）
- 第四个区域是一个数据块位图，长度为若干个块：记录后面的数据块区域中有哪些已经被分配出去使用
- 最后的区域则是数据块区域：每个被分配出去的块保存了文件或目录的具体内容

```rust
// 第一个区域：超级块
pub struct SuperBlock {
    magic: u32, // 魔数：验证有效性
    pub total_blocks: u32, // 文件系统总块数
    pub inode_bitmap_blocks: u32, // 索引节点位图块数
    pub inode_area_blocks: u32, // 索引节点区域块数
    pub data_bitmap_blocks: u32, // 数据块位图区域块数
    pub data_area_blocks: u32, // 数据库区域块数
}
impl SuperBlock {
    pub fn initialize(&mut self, total_blocks: u32, inode_bitmap_blocks: u32, inode_area_blocks: u32, data_bitmap_blocks: u32, data_area_blocks: u32 ); // 更上层初始化
    pub fn is_valid(&self) -> bool { // 根据魔数判断合法
    }
}

// 第二/四个区域：位图-索引节点 / 位图-数据块
pub struct Bitmap { // 位图区域管理器：区域起始编号+块数
    start_block_id: usize,
    blocks: usize,
} 
type BitmapBlock = [u64; 64]; // 一个块数据（划分方便操作）
const BLOCK_BITS: usize = BLOCK_SZ * 8; // 一个块中有多少个bit
impl Bitmap {
    pub fn alloc(&self, block_device: &Arc<dyn BlockDevice>) -> Option<usize> {
    } // 遍历Bitmap中每个块，再遍历这个块中的每一个[u64]找到第一个为 0 的位置，该位置置1，返回该位的位置（在位图中的第n个比特位），以此作为分配的索引节点/数据块的编号；否则返回None
}

// 第三个区域：索引节点（包含文件/目录的元数据，以下仅写“文件”）
const INODE_DIRECT_COUNT: usize = 28;
pub struct DiskInode {
    pub size: u32, // 文件内容的字节数
    pub direct: [u32; INODE_DIRECT_COUNT], // 直接索引，数据块里是文件数据
    pub indirect1: u32, // 一级间接索引，该块上每一个u32指向一个文件数据块
    pub indirect2: u32, // 二级间接索引，该块上每一个指向一个一级间接索引
    type_: DiskInodeType, // 索引节点类型
}
pub enum DiskInodeType {
    File,
    Directory,
}
impl DiskInode {
    pub fn initialize(&mut self, type_: DiskInodeType) {
    } // 一 / 二级索引全部置为0
    pub fn is_dir(&self) -> bool {
    }
    pub fn is_file(&self) -> bool { // 确定文件类型
    }
    pub fn get_block_id(&self, inner_id: u32, block_device: &Arc<dyn BlockDevice>) -> u32 { // 获得索引中的第inner_id数据块的block_id
    }
    pub fn data_blocks(&self) -> u32 { // 返回文件内容字节数
    }
    fn _data_blocks(size: u32) -> u32 { // 容纳size个字节需要多少数据块
    }
    pub fn total_blocks(size: u32) -> u32 { // 返回文件块+索引块数量
    }
    pub fn blocks_num_needed(&self, new_size: u32) -> u32 {
    } // 扩容到new_size个字节需要新增多少数据块
    pub fn increase_size(&mut self, new_size: u32, new_blocks: Vec<u32>, block_device: &Arc<dyn BlockDevice>);
    // 扩容函数，size为扩容后大小，blocks为扩容所需块编号（由上层分配）
    pub fn clear_size(&mut self, block_device: &Arc<dyn BlockDevice>) -> Vec<u32>; //清空文件并且回收数据块
    pub fn read_at(&self, offset: usize, buf: &mut [u8], block_device: &Arc<dyn BlockDevice>) -> usize { 
    } // 将文件内容从 offset 字节开始的部分读到内存中的缓冲区 buf 中，返回读到字节数
    pub fn write_at()
}

// 目录项结构（文件项无结构）
const NAME_LENGTH_LIMIT: usize = 27;
pub struct DirEntry { // 该结构保存在数据块中
    name: [u8; NAME_LENGTH_LIMIT + 1], // 这一级目录/这个文件的名字
    inode_number: u32, // 这一级目录/这个文件的索引序号
}
pub const DIRENT_SZ: usize = 32; // 每个数据块可以存储16个
impl DirEntry {
    pub fn empty() -> Self;
    pub fn new(name: &str, inode_number: u32) -> Self;
    pub fn name(&self) -> &str;
    pub fn inode_number(&self) -> u32
    }
	pub fn as_bytes(&self) -> &[u8] { // 为了符合read/write_at接口
    }
    pub fn as_bytes_mut(&mut self) -> &mut [u8] {
    }
}
```

4、磁盘块管理器层：合并了上述核心数据结构和磁盘布局所形成的磁盘文件系统数据结构

```rust
// 一个文件系统对应一个磁盘（分区）
pub struct EasyFileSystem {
    pub block_device: Arc<dyn BlockDevice>,
    pub inode_bitmap: Bitmap, // 索引节点位图
    pub data_bitmap: Bitmap, // 数据块位图
    inode_area_start_block: u32, // 索引区域起始块编号
    data_area_start_block: u32, // 数据块区域起始块编号
}
impl EasyFileSystem {
    pub fn create(block_device: Arc<dyn BlockDevice>, total_blocks: u32, inode_bitmap_blocks: u32,) -> Arc<Mutex<Self>> {
    } // 传入 总共的块数量/索引位图的块数量 规划好整个磁盘，创建新文件系统并清理内存
      // 同时初始化内存中的超级块、创建根目录
    pub fn open(block_device: Arc<dyn BlockDevice>) -> Arc<Mutex<Self>> {
    } // 从一个写入了easy-fs镜像（即按照该格式排布的数据块集合）的块设备block_device上打开文件系统
    pub fn get_disk_inode_pos(&self, inode_id: u32) -> (u32, usize) {
    } // 根据索引的编号，返回它所在磁盘块编号block_id和块内偏移
    pub fn get_data_block_id(&self, data_block_id: u32) -> u32 {
    } // 得到某数据块的磁盘块编号
    pub fn alloc_inode(&mut self) -> u32 {
    } // 分配一个索引返回其编号
    pub fn alloc_data(&mut self) -> u32 {
    } // 分配一个数据块返回其磁盘块编号
    pub fn dealloc_data(&mut self, block_id: u32) {
    }
}
```

注意：只要知道了数据所在的具体磁盘块号和块内偏移，可以以任意结构体方式操作这一段数据`get_block_cache(block_id, device).lock().modify(offset, |变量名: &mut 结构体| {})`

5、索引节点层：管理索引节点，实现了文件创建/文件打开/文件读写等成员函数

便于直接看到目录树结构中逻辑上的文件和目录

- `DiskInode` 放在磁盘块中比较固定的位置
-  `Inode` 是放在内存中的记录文件索引节点信息的数据结构

```rust
pub struct Inode {
    block_id: usize,
    block_offset: usize, // 前两个用于记录具体位置
    fs: Arc<Mutex<EasyFileSystem>>, // 便于操作传参
    block_device: Arc<dyn BlockDevice>,
}

// 简化 get_block_cache.lock.read/modify 流程
impl Inode {
    fn read_disk_inode<V>(&self, f: impl FnOnce(&DiskInode) -> V) -> V {
    } // 读取数据并且用闭包f处理
    fn modify_disk_inode<V>(&self, f: impl FnOnce(&mut DiskInode) -> V) -> V { // 读取可修改数据并且用闭包f处理（都是更改索引节点 DiskInode 的值）
    }
}

impl EasyFileSystem {
    pub fn root_inode(efs: &Arc<Mutex<Self>>) -> Inode {
    } // 获取根目录
}

impl Inode {
    pub fn new(block_id: u32, block_offset: usize, fs: Arc<Mutex<EasyFileSystem>>, block_device: Arc<dyn BlockDevice>) -> Self {
    } // 创建
    // 文件索引（仅根目录调用）
    pub fn find(&self, name: &str) -> Option<Arc<Inode>> {
    } // 返回本索引指向的目录下名称为name的文件的索引的新建Inode
    fn find_inode_id(&self, name: &str, disk_inode: &DiskInode) -> Option<u32> { // 找到传入的索引节点指向的目录下名称为name的文件的索引序号
    }
    // 文件列举（仅根目录调用）
    pub fn ls(&self) -> Vec<String> {
    } // 返回该目录下所有文件的文件名的数组
    // 文件创建（仅根目录调用）
    pub fn create(&self, name: &str) -> Option<Arc<Inode>> {
    } // 创建新的文件并返回其Inode，若存在则返回None
    // 文件清空
    pub fn clear(&self) {
    } // 以某些方式打开时需要先传入文件Inode清空
    // 文件读写
    pub fn read_at(&self, offset: usize, buf: &mut [u8]) -> usize {
    } // 从offset偏移处开始读
    pub fn write_at(&self, offset: usize, buf: &[u8]) -> usize {
    } // 注意：在写之前需要先扩容为offset+buf.len()容量
    fn increase_size(&self, new_size: u32, disk_inode: &mut DiskInode, fs: &mut MutexGuard<EasyFileSystem>) {
    }    
}
```



**内核中的easy-fs**

```rust
// 内核块设备实例
type BlockDeviceImpl = virtio_blk::VirtIOBlock; // 一个实现了BlockDevice类特征的结构体
lazy_static! {
    pub static ref BLOCK_DEVICE: Arc<dyn BlockDevice> = Arc::new(BlockDeviceImpl::new());
}

// 内核索引节点层
pub struct OSInode { // 表示进程中一个被打开的常规文件或目录
    readable: bool,
    writable: bool,
    inner: UPSafeCell<OSInodeInner>,
}
pub struct OSInodeInner {
    offset: usize, // 读写过程中的偏移量
    inode: Arc<Inode>,
}
impl File for OSInode {
    fn readable(&self) -> bool { self.readable }
    fn writable(&self) -> bool { self.writable }
    fn read(&self, mut buf: UserBuffer) -> usize {
    } // 直接使用inode的read/write_at
    fn write(&self, buf: UserBuffer) -> usize {
    }
}

// 内核文件系统实现
// 文件系统初始化
lazy_static! {
    pub static ref ROOT_INODE: Arc<Inode> = {
    }; // 打开efs并且获取根目录
}
// 打开文件
bitflags! {
    pub struct OpenFlags: u32 { // 打开文件的方式
        const RDONLY = 0;
        const WRONLY = 1 << 0;
        const RDWR = 1 << 1;
        const CREATE = 1 << 9;
        const TRUNC = 1 << 10;
    }
}
impl OpenFlags {
    pub fn read_write(&self) -> (bool, bool) {
    } // 返回（可读，可写）
}
pub fn open_file(name: &str, flags: OpenFlags) -> Option<Arc<OSInode>> {
} // 根据flags的要求打开文件并且返回inode
```



### 进程间通信

**管道**

```rust
// 系统调用：为当前进程打开一个管道（包含一个只读、一个只写文件）
pub fn sys_pipe(pipe: *mut usize) -> isize;// pipe:应用地址空间中一个长度为2的usize数组的起始地址，内核负责讲管道读端、写端的文件描述符写入
pub fn sys_close(fd: usize) -> isize; // 关闭一个文件
```

基于文件的管道

```rust
// 管道的一端（读/写）：会实现File特征，作为文件访问
pub struct Pipe {
    readable: bool,
    writable: bool,
    buffer: Arc<Mutex<PipeRingBuffer>>,
}
impl Pipe {
    pub fn read_end_with_buffer(buffer: Arc<Mutex<PipeRingBuffer>>) -> Self {}
    pub fn write_end_with_buffer(buffer: Arc<Mutex<PipeRingBuffer>>) -> Self {} // 根据一个已有的管道创建其读端和写端
}
impl File for Pipe {
    fn read(&self, buf: UserBuffer) -> usize {
    } // 从文件中最多读取应用缓冲区大小那么多字符：如果文件中没有字符且没有写端则返回，否则任务挂起
}

// 管道：
enum RingBufferStatus { FULL, EMPTY, NORMAL }
pub struct PipeRingBuffer {
    arr: [u8; RING_BUFFER_SIZE],
    head: usize,
    tail: usize, // 维护循环队列
    status: RingBufferStatus, // 缓冲区状态
    write_end: Option<Weak<Pipe>>, // 写端的弱引用计数，来确认是否还有写端
}
impl PipeRingBuffer {
    pub fn new() -> Self { // 全部置为0，写端置为None
    }
    pub fn set_write_end(&mut self, write_end: &Arc<Pipe>) { 
    } // 保留其写端的弱引用计数
    pub fn read_byte(&mut self) -> u8 {
    } // 读取管道中的一个字节，并且更新队头（如果与队尾重合则改为empty）
    pub fn available_read(&self) -> usize {
    } // 计算管道中还有多少个字节可以读取
    pub fn all_write_ends_closed(&self) -> bool {
    } // 判断管道的所有写端是不是都被关闭了
}

pub fn make_pipe() -> (Arc<Pipe>, Arc<Pipe>) { // 创建一个管道并返回其读写端
}

impl TaskControlBlockInner {
    pub fn alloc_fd(&mut self) -> usize {
    } // 在进程控制块中分配一个最小的空闲文件描述符来访问新打开的文件
}
```



**命令行参数与标准I/O重定向**

命令行参数

在user_shell中读取一行后，根据空格分隔成`Vec<String>`，然后手动在每个字符串后面加上`\0`，在最后加上`0 as *const u8`，将字符串数组的起始地址传入`sys_exec()`内核调用

```rust
// 系统调用更新
pub fn sys_exec(path: *const u8, mut args: *const usize) -> isize {
} // 依次转换地址并取出参数，在调用TCB::exec时传入

impl TaskControlBlock {
     pub fn exec(&self, elf_data: &[u8], args: Vec<String>) {
    } // 在从ELF文件创建进程后把参数压入用户栈（此时用户栈为空）
}
```

根据TCB创建时从ELF中读出来的内容，所有进程第一次进入用户态都是从`_start`进入：这个函数会依次取出命令行参数并且放入一个数组中



标准输入输出重定向

```rust
// 系统调用：将进程中一个已经打开的文件复制一份并分配到一个新的文件描述符中
pub fn sys_dup(fd: usize) -> isize; //（在符表中分配一个新的描述符指向一个复制）
```

在用户态的`user_shell`程序中，要检查是否存在通过`<`/`>`进行输入输出重定向：

存在则移除，并记录输入/输出的文件名并打开；

这时候关掉`0/1`的文件描述符，给打开的文件`dup`一个新的，由于`alloc_fd()`一定会分配最小的可用文件描述符（先扫描符表中有无可用的，再push一个），所以这个文件就可以顶替掉`0/1`





### 并发

- 存在线程前：进程是程序的基本执行实体，是程序关于某数据集合上的一次运行活动，是			系统进行资源（处理器、 地址空间和文件等）分配和调度的基本单位。
- 存在线程后：进程是线程的资源容器， 线程成为了程序的基本执行实体。

**并发相关术语**

- 共享资源（shared resource）：不同的线程/进程都能访问的变量或数据结构。
- 临界区（critical section）：访问共享资源的一段代码。
- 竞态条件（race condition）：多个线程/进程都进入临界区时，都试图更新共享的数据结构，导致产生了不期望的结果。
- 不确定性（indeterminate）： 多个线程/进程在执行过程中出现了竞态条件，导致执行结果取决于哪些线程在何时运行， 即执行结果不确定，而开发者期望得到的是确定的结果。
- 互斥（mutual exclusion）：一种操作原语，能保证只有一个线程进入临界区，从而避免出现竞态，并产生确定的执行结果。
- 原子性（atomic）：一系列操作要么全部完成，要么一个都没执行，不会看到中间状态。在数据库领域， 具有原子性的一系列操作称为事务（transaction）。
- 同步（synchronization）：多个并发执行的进程/线程在一些关键点上需要互相等待，这种相互制约的等待称为进程/线程同步。
- 死锁（dead lock）：一个线程/进程集合里面的每个线程/进程都在等待只能由这个集合中的其他一个线程/进程 （包括他自身）才能引发的事件，这种情况就是死锁。
- 饥饿（hungry）：指一个可运行的线程/进程尽管能继续执行，但由于操作系统的调度而被无限期地忽视，导致不能执行的情况。

**线程**（一个进程在一个时刻有多个执行点）

- 程序计数器寄存器来记录当前的执行位置
- 一组通用寄存器记录当前的指令的操作数据
- 一个栈来保存线程执行过程的函数调用栈和局部变量

```rust
// 系统调用
pub fn sys_thread_create(entry: usize, arg: usize) -> isize 
// 创建新的线程（entry:入口函数地址， arg:参数）
pub fn sys_waittid(tid: usize) -> i32
// 等待线程结束：进程/主线程回收资源（tid:线程id，由主线程调用）
```

线程管理由进程而来

```rust
pub struct TaskControlBlock {
    pub process: Weak<ProcessControlBlock>,
    pub kernel_stack: KernelStack,
    inner: UPSafeCell<TaskControlBlockInner>, // 可变
}
pub struct TaskControlBlockInner {
    pub trap_cx_ppn: PhysPageNum, // 应用地址空间中线程的 Trap 上下文被放在的物理页帧的物理页号
    pub task_cx: TaskContext, // 暂停线程的线程上下文，用于线程切换
    pub task_status: TaskStatus, // 当前线程的执行状态
    pub exit_code: Option<i32>, // 线程退出码
    pub res: Option<TaskUserRes>,
}
pub struct TaskUserRes {
    pub tid: usize, // 线程标识符
    pub ustack_base: usize, // 线程栈顶
    pub process: Weak<ProcessControlBlock>, // 所属进程
}
```

	进程控制块

```rust
pub struct ProcessControlBlock {
    pub pid: PidHandle,
    inner: UPSafeCell<ProcessControlBlockInner>,
}
pub struct ProcessControlBlockInner {
    ...
    pub tasks: Vec<Option<Arc<TaskControlBlock>>>,
    pub task_res_allocator: RecycleAllocator,
}
```

**锁**

相关数据结构：使用锁来包裹共享资源

```rust
pub struct ProcessControlBlock {
    pub pid: PidHandle,
    inner: UPSafeCell<ProcessControlBlockInner>,
}
pub struct ProcessControlBlockInner {
    ...
    pub mutex_list: Vec<Option<Arc<dyn Mutex>>>, // 进程可能存在多个互斥资源
}
pub trait Mutex: Sync + Send { // 互斥锁特征
    fn lock(&self);
    fn unlock(&self);
}
pub struct MutexBlocking { // 实现互斥锁特征的结构
    inner: UPSafeCell<MutexBlockingInner>,
}
pub struct MutexBlockingInner {
    locked: bool, // 是否上锁
    wait_queue: VecDeque<Arc<TaskControlBlock>>, // 上锁的等待队列 
}
```

相关系统调用

```rust
pub fn sys_mutex_create(blocking: bool) -> isize {
} // 创建一个新的锁：当前mutex_list是否有空位/锁的类型来创建

pub fn sys_mutex_lock(mutex_id: usize) -> isize {
} // 只负责调用当前线程的第id个锁的lock()方法
impl Mutex for MutexBlocking {
    fn lock(&self) {
    } // 如果已经上锁则加入等待队列，否则上锁
}

pub fn sys_mutex_unlock(mutex_id: usize) -> isize {
}// 只负责调用当前线程的第id个锁的unlock()方法
impl Mutex for MutexBlocking {
    fn unlock(&self) {
    } // 如果有等待的线程则唤醒，否则释放锁
}
```



**信号量**：适用于一个共享资源可以被有限个线程同时访问的情况（互斥锁即为N=1）

P操作：尝试进入，失败则阻塞

V操作：信号量的值+1，如果有线程等待则唤醒

（注意，以上两个操作都应该有原子性）

```rust
pub struct ProcessControlBlock {
    pub pid: PidHandle,
    inner: UPSafeCell<ProcessControlBlockInner>,
}
pub struct ProcessControlBlockInner {
    ...
    pub semaphore_list: Vec<Option<Arc<Semaphore>>>, // 进程可能有多个信号量
}

pub struct Semaphore {
    pub inner: UPSafeCell<SemaphoreInner>,
}
pub struct SemaphoreInner {
    pub count: isize, // 信号量值（count <= 0时代表有线程在等待）
    pub wait_queue: VecDeque<Arc<TaskControlBlock>>, // 等待序列
}
impl Semaphore {
    pub fn new(res_count: usize) -> Self {
    } // 创建新的信号量，置放初始信号值
    pub fn up(&self) {
    } // V操作：count++, count <= 0时从等待队列中取队头唤醒
    pub fn down(&self) {
    } // P操作：count--, count < 0时进入等待队列
}
```



**条件变量**

线程在检查满足某一条件后才会执行（条件变量时一个线程等待队列）

`wait`操作：释放锁 => 挂起自己 => 被唤醒后获取锁

`signal`操作：找到挂在条件变量上面的线程并唤醒

```rust
pub struct ProcessControlBlock {
    pub pid: PidHandle,
    inner: UPSafeCell<ProcessControlBlockInner>,
}
pub struct ProcessControlBlockInner {
    ...
    pub condvar_list: Vec<Option<Arc<Condvar>>>, // 进程中的条件变量列表
}
pub struct Condvar {
    pub inner: UPSafeCell<CondvarInner>,
}
pub struct CondvarInner {
    pub wait_queue: VecDeque<Arc<TaskControlBlock>>, // 条件变量：等待队列
}
impl Condvar {
    pub fn new() -> Self {
    } // 创建空的等待队列
    pub fn signal(&self) {
    } // 唤醒条件变量的等待队列的队头
    pub fn wait(&self, mutex:Arc<dyn Mutex>) {
    } // 释放互斥锁（线程在进入前获取），挂起当前进程，恢复后获取锁
}
```







# ArceOS学习记录

第三阶段时间比较紧张，就只能写写测试写不了挑战题了

**第一部分`UniKernel`**

`print_with_color`

在输出println宏的实现处加上标识颜色的`ASCⅡ`码即可，需要注意（本人踩过坑）的是如果不想引入`format!`来直接把颜色字符拼接进入要打印字符中而是分别打印，需要注意字符打印导致的换行问题，这个会导致后边测试脚本在读取数据时检测不通过的问题

`support_hashmap`

这个去网上查了一下资料，还以为有什么高级实现的方法

结果最后还是使用了最朴实无华的取模插入

果然所有的数据结构都很难想

`alt_alloc`

在怎么实现上还是纠结了挺久的，是存储字符数转化成页还是存储页转化成字符、如果有新加入的内存怎么在其中表示……后面不得不去找了一下，发现原来可以不支持新加入内存（）

其实还是学到了很多的，在上操作系统理论课的时候根本没有想过这些内存是由一个统一初始化的内存管理器来进行管理，就只是单纯的知道了一下页表是什么

**第二部分宏内核**

`sys_mmap`

难度还可以，好像在这里没有花很久时间

`ramfs_rename`

因为没有什么大项目的经验导致对依赖很不敏感，在实现了之后一直进入不了我想用的DirNode的trait里面

后面不断调试才终于在偶然中发现如果不在根目录的`cargo.toml`中使用patch的话需要改两个cargo.toml

**第三部分`Hypervisor`**

`simple_hv`

这个其实挺简单的，但是卡了我很久很久。遇到的问题是我在一开始就触发不了`panic`程序会直接卡死，然后依然是不断通过打印去定位错误，竟然发现卡死在了`_run_guest`的汇编代码里面，就硬着头皮去看汇编。还是一直发现不了卡死的原因……

总之就是试了很久，分析`qemu`的日志才发现是`store_page_fault`和时钟错误交替出现，拷打了一下AI之后才发现是没有
