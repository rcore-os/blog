---

title: <Rust补完计划>
date: 2024-11-10 12:00:28
categories:
    - 补完计划
tags:
    - author:Lfan-ke
    - repo:https://github.com/LearningOS/rust-rustlings-2024-autumn-Lfan-ke
mathjax: true

---

# Rust补完计划

src：[rust官网](https://www.rust-lang.org/)，[rust官文]()，[rust官仓]()，[crates.io](crates.io)

​	Rust可看作一个在语法层面（编译时）具有严格检查和限制的C语言上位。且扩展了面向对象的便捷方法绑定。编译和运行方式类似于C/C++，可以`rustc xxx.rs`编译，`./xxx`运行。有约定的项目目录格式，可使用`Cargo`配置`toml`进行包管理、编译、运行、测试等等。包资源网站为`CratesIO`，见`src↑`。不支持运算符重载，支持多态。其中语句为：`表达式+;`，语句的值是`()`。

​	为了安全，几乎所有的方法/变量/属性都是私有的，除非使用`pub`进行显式公用声明。

## 快速开始

安装：

```shell
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

推荐开发环境：

> VSCode + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)，VIM，[RustRover](https://www.jetbrains.com/rust/)

见面礼：

```rust
// main.rs
fn main() { println!("hello world!") }
```

```shell
rustc main.rs -o main && ./main
```

使用包管理器：

```cargo
cargo new my_project_name	# 生成项目目录结构，包括`toml`、`lock`、`src`、`test`等等
cargo build					# 编译后生成文件在`target/debug/项目名`下生成可执行文件，可选--release生成优化版本
cargo run					# 仅run也会build
cargo clean
cargo check					# 仅检查语法是否出错
# 安装新的包，在Cargo.toml的依赖下配置：`包名=版本`即可
```



## 初次接触

语法语义一览表：

>标识符：`^[a-Z0-9_][a-Z0-9_$]*` 其中，命名习惯为：`CONST_VAL`，`StructName`，`ImplName`，`method_name`，`val_name`
>
>注释符：`// 单行注释`，`/* 多行注释 */`，`/// 文档注释，支持MD语法以及文档测试以及自动生成文档`
>
>运算符：`+ - * / % += -= *= /= %= ! ~|& ^ [] ; , >> << == != < <= > >= && ||`
>
>变量声明：`const CONST_VAL: i32 = 123;` `static STATIC_VAL: u32 = 321;` `let emm = 233;` `let mut var = 0;`
>
>类型别名：`type word = u64`
>
>类型转换：`var as type_name` `type_name::from(var)`
>
>分支：`if 条件必须是布尔值 { ... } else { ... }` `match obj { case xx => { ... }, _ => { ... } }`
>
>循环：`loop { ... }` `for i in 0..10` `while n < 233`，`break` `continue`
>
>支持循环标签来跳出指定的循环：`tag1: loop { tag2: while true { break: tag1 } }`
>
>函数格式：`fn add(a: i32, b: i32) -> i32 { a + b }` 默认返回值是最后一条表达式的值，等同于：`return a+b;`
>
>匿名函数：`|a: i32, b: i32| -> i32 { a + b }` 如果只有一条执行语句，可以省略大括号
>
>类和对象：采用结构体和特质抽象，数据方法分离的思想
>
>方法多态：方法和数据的关系是多对多，支持采用数据/特质签名来访问匿去的数据/方法：`TraitA::fun1(&obj)`
>
>基本类型：i8 u8 i16 u16 ... 有无符号+位数，str，bool，f64 ... 同整型
>
>类型变体：`&i32` - 不可变引用，`&mut` - 可变引用，`*const` - 不可变裸指针，`*mut` - 可变裸指针
>
>容器类型：`[1, 2, 3]` - `Array` - 定长同类型，`(1, "heke", 1228)` - `Tuple` - 定长不可变
>
>数据容器：`struct Person { age: u8; name: &str; }` `struct Bag (i32, i32, u8)`
>
>枚举类型：`enum State { StateA, StateB, State233=233, ,PA(ch) ... }` 详见特殊部分与模式匹配 `↓`
>
>其他容器：`Vec`，`Deque`，`Queue`，`BTreeSet`，`BTreeMap` ...
>
>导入管理：`mod package_emm;` `mod mode_name { fn emm() { ... } }` `use mode_name::emm;`
>
>异步支持：`async`，`await`，`std::thread`，以及异步的通道和异步智能指针

快速迁移（将采用Py作为对比语言）：

---

```python
def emm(a: int, b: int) -> float:
    return float(a) + b
```

```rust
pub fn emm(a: i32, b: i32) -> f64 {
    // 运算块的值是最后一句表达式的值，所以不显示写return也可以，语句的值是()表示空！
    a as f64 + b    // 或写为：`return a as f64 + b` 或 `return f64::from(a) + b;`
}
```

---

```python
def emm(op) -> (int, str, int):
    op
    return 1, "heke", 1228
```

```rust
pub fn emm(op) -> (i32, &str, i32) {  // op会在编译时自动根据所调用时的类型生成对应类型标签的多态方法
    op;
    1, "heke".as_str(), 1228
}
```

---

```python
class A:
    def __init__(self, a: int, b: int, c: int):
        self.a = a
        self.b = b
        self.c = c
    
    def method233(self):
        self.a += self.b
        return None

if __name__ == '__main__':
	obj = A(1,2,3)
    obj.method233()
    print(f"a: {obj.a}, b: {obj.b}")
    print("c: ", obj.c)
```

```rust
struct A {
    pub a: i32;
    pub b: i32;
    pub c: i32;
}
impl A {
    pub fn method233(&self) {
        self.a += self.b;
        return None;
    }
}
fn main() {
    let mut obj = A {a: 1, b: 2, c: 3};
    obj.method233();
    println!("{}", format!("a: {}, b: {}", obj.a, obj.b));
    println!("c: {}", obj.c);
}
```

---

```python
# method.py
def func():
    pass
```

```python
# __init__.py
from method import *

from method import func   # 语法多余，但是为了对比语法
from .method import func   # 语法多余，但是为了对比语法
__all__ = ['func']

func()
method.func()
```

```rust
// method.rs
pub fn func() {
    ;
}
```

```rust
// lib.rs / mod.rs
mod method;
use method::*;

pub use method::func;
pub use crate::method::func;   // crate表示从包的根目录进行相对路径索引

// 如果有main，则在main内：
func();
method::func();
crate::method::func();
```


<!-- more -->


## 特殊部分

### 所有权机制





### 变量与容器







### 结构体相关







### 枚举相关







### 绑定方法







### 模式匹配







### 多态详解







### 智能指针







### 包管理相关







### 异步相关

