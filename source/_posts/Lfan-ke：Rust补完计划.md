---
title: Rust补完计划
date: 2025-05-01 12:00:28
categories:
    - 补完计划
tags:
    - author:Lfan-ke
    - author-alias:禾可/禾可1228/"Leo Cheng"
    - repo:https://github.com/LearningOS/2025s-rustling-Lfan-ke
    - description:初次学习Rust整理后的笔记
mathjax: true
---

# Rust补完计划

src：[rust官网](https://www.rust-lang.org/)，[rust官文](https://doc.rust-lang.org/std/index.html)，[rust官仓](https://github.com/rust-lang/)，[crates.io](crates.io)，[rust-wiki](https://rustwiki.org/zh-CN/reference/items/associated-items.html)，[卡狗圣经](https://course.rs/about-book.html)

​	Rust可看作一个在语法层面（编译时）具有严格检查和限制的C语言上位。且扩展了面向对象的便捷方法绑定。编译和运行方式类似于C/C++，可以`rustc xxx.rs`编译，`./xxx`运行。有约定的项目目录格式，可使用`Cargo`配置`toml`进行包管理、编译、运行、测试等等。包资源网站为`CratesIO`，见`src↑`。不支持运算符重载，支持多态。其中语句为：`表达式+;`，语句的值是`()`。

​	为了安全，几乎所有的方法/变量/属性都是私有的，除非使用`pub`进行显式公用声明。

​	说到底，编程语言就是人类用来快速生成机器码以便于执行的模板引擎，有的语法层面(编译时/解释时)有强约束，有的仅仅是把特定字符串替换成另外的字符串或二进制，属于弱约束或者无约束。所有你在编程语言所看到的抽象，在机器码的层面本来就是一场幻月楼阁。比如你在编程语言层面，继承多态面向对象权限生命周期搞的花里胡哨的，但是在机器码看来，就仅仅是把PC变一下，或者某数据/指针变一下而已，你所关心的语法层面，语义特性，都是高层编译时/解释时的语法约束。这些约束让你写正确的高级语法的同时，最重要的是保证执行的结果符合预期。所以学底层的，一定要层层解耦，梳理层层抽象！



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
cargo clean					# 清除target下编译后的文件
cargo check					# 仅检查语法是否出错
# 安装新的包，在Cargo.toml的依赖下配置：`包名=版本`即可
```

包管理器代理：`vim ~/.cargo/config.toml`

```ini
[source.crates-io]
replace-with = 'ustc'

[source.ustc]
registry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"
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
>类和对象：采用结构体`struct`(存数据)和特质`trait`(类似于抽象`interface`存方法)抽象，数据方法分离的思想
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
    pub a: i32,
    pub b: i32,
    pub c: i32,
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
from method import *		# '0

from method import func		# 语法多余，但是为了对比语法'1
from .method import func	# 语法多余，但是为了对比语法'2
__all__ = ['func']			# 'export

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
mod method;						// '0
use method::*;					// '0

pub use method::func;			// pub use使得导入此包的也可以被别的包从此包导入'1 'export
pub use crate::method::func;	// crate表示从包的根目录进行相对路径索引'2 'export

// 如果有main，则在main内：
func();
method::func();
crate::method::func();
```

<!-- more -->

## 特殊部分

### 所有权机制

​	在其他语言中，变量的赋值一向秉持：`常用量固定地址，简单变量直接复制，复杂变量或引用复制指针不复制本体`的弯弯绕绕，导致很多编程语言新手写出一堆堆耐人寻味的bug。Rust引入的所有权机制将这种不同语言独具特性的弯弯绕绕统一划分为了两类：实现了`Copy Trait`的类型和未实现`CT`$$^{笔记中出现过一次的全名在下次出现若无歧义将直接采用首字母缩写}$$的类型。前者赋值操作会执行`.clone()`，后者则是所有权的移交，这样子保证了数据的访问安全。

​	如何理解所有权呢？对于未实现`CT`的类型：

- 你有50块钱：`let 你的50块钱 = 微信余额;`
- `let 小明 = 你的50块钱;`你把 50 v 给了小明
- 你现在不能使用 v 过去的 50 块钱，使用会报错
- 小明现在是这 50 块钱的所有者

​	对于实现了CT的类型，就是你一个我一个，反正是复制过去的，大家都有份，此时在内存中已经是两个位置截然不同的家伙了。

这就是所有权的移交：

```rust
struct RMB (pub u32);

fn pay50from(rmb: RMB) -> RMB {	// 使用RMB调用函数时，RMB所有权已经不是你的了，是函数的第一个参数的
    return RMB;					// 现在return出去的时候，RMB的所有权将会从函数移交给返回值的接收者
}

impl RMB {
    pub fn show_rmb(&self) { println!("我还有：{}", self.0) }
}

fn main() {
    let your = RMB(50);   // 你有50
    let xiao_ming = pay50from(your);
    // your.show_rmb() -> Panic! 因为你的50已经v给小明了
    xiao_ming.show_rmb()  // 将会输出：`我还有：50`，因为50现在是小明的
}
```

​	而对于常用的基本类型：`bool`，`str`，`u32`等等都是内置实现CT的，所以`let a = 233; let mut b = a;`的时候，发生的是复制而非转移所有权！此时即使`b += 1`，`a`也可以照常使用，且`a`与`b`无关系，`b`变化不会影响到`a`！



### 引用与借用

​	如何通俗理解引用与借用呢？引用：`我有个朋友他有 - 自己不能修改`，借用：`我朋友借我玩玩的，他说随便玩 - 自己可以修改`。引用可以同时存在多个：`A是BCDEF的朋友，则==B C D E F==都可以说：我朋友A他有`，借用同时只能存在一个，且与引用互斥：`但是如果A借给了B，则CDEF就不能说：A他有，因为B还指不定把东西搞成什么样呢，CDEF带着其他人去了A那里，结果A说东西被B霍霍了...不就尴尬了`。所以借用和引用同时存在具有不安全，未定义，不确定的错误，会引发`Panic!`。

```rust
struct Switch {
    owner: String,
    game_total: u32,  // 假设这是你的游戏库存
}

impl Switch {
    pub fn add_game(&mut self) { self.game_total += 1; } 
    pub fn rmv_game(&mut self) { self.game_total -= 1; }
    pub fn show_game(&self) { println!("游戏机所有者：[{}]，有[{}]款游戏！", self.owner, self.game_total); }
}

fn main() {
    let mut A_switch = Switch { owner: "A".to_string(), game_total: 233 };
    A_switch.show_game();		// 游戏机所有者：[A]，有[233]款游戏！
    
    // A的朋友C引用(&)了A的switch，C可以和其他人炫耀：我那哥们A，打游戏杠杠的，有233款游戏呢！
    let C = &A_switch;
    C.show_game();				// 游戏机所有者：[A]，有[233]款游戏！
    
    // A把游戏机借用(&mut - 别名: 可变引用)给了B
    let B = &mut A_switch;
    for i in 0..100 { B.add_game() }	// B污染了库存，增加了[0, 100)这100个辣鸡游戏
    for i in 0..=10 { B.rmv_game() }	// B把游戏又卸了[0, 10]这11个游戏
    
	// C.show_game() -> Panic! 此时C已经不能炫耀A有233个游戏了，不然会被别人说：你说谎！
    B.show_game();						// 游戏机所有者：[A]，有[322]款游戏！
    // A：好好好，你这样玩是吧，FK，B，(此处省略n条花言巧语，F是friendly，K是kindly)！
}
```

<!-- 彩蛋：heke1228 -->

### 生命周期

​	上面的例子粗略的让大家理解了一下引用与借用的区别，那么问题来了，不是说：`==引用与借用不可共存==`？，看似C$$^{存在引用}$$还在的情况下，为什么还能让B$$^{存在借用}$$胡作非为？

​	那么就不得不提生命周期这个概念了：人有生老病死，变量/引用也一样。在B胡作非为的时候，由于下文没有C出场的机会，所以C先行告退了。所以B在借到A游戏机的时候，C已经不在了，所以`==B和C并没有同框出现过==`，就像奥特曼和他的人间体。

​	那么使用死神之眼，使用生命周期标识`'life_tag`，以生命周期的角度观察一下上面示例的`main`函数：

``` rust
fn main() {
    let mut A_switch = Switch { owner: "A".to_string(), game_total: 233 };  // 'a_alive A入场 aa
    A_switch.show_game();
    
    let C = &A_switch;														// 'c_alive C入场 cc
    C.show_game();
    																		// 此时以下无C，C退场领盒饭去了 cc
    
    let B = &mut A_switch;													// 'b_alive B入场 bb
    for i in 0..100 { B.add_game() }
    for i in 0..=10 { B.rmv_game() }
    
    B.show_game();
}																			// main函数结束，B和A相继退场 aa bb
```

同时，生命周期可以在引用声明的时候使用`生命周期描述符`$$^{[a-Z0-9_]+}$$来显示告诉编译器某引用的生命周期：

``` rust
let a = &'1 emm;				// &+' 后面的`1`			就是生命周期描述符
let b = &'b_life_tag emm;		// &+' 后面的`b_life_tag`	就是生命周期描述符
```

如果想指定一个程序运行时一直存在的引用，或者借此来绕过编译器的生命周期检查，可以使用`static`：

``` rust
let a = &'static emm;
// 或者创建一个具有'static生命周期的变量
static	EMM = 233;
// 与const的区别就是，const不可变，且在编译时确定，static可变(前加mut)，可在运行时确定或修改：
const	EMM = 233;
```

额外需要注意的一点就是：`本体退场之后，所有的引用和借用将会不可用！`，如果需要额外指定生命周期，请在函数或结构体指明生命周期

``` rust
fn temp(&'a var1, &'b var2) -> &'a res { ... }

struct Temp<'a, T> {
    param1: &'a type,
    param2: &'static type,
    ...
}
```



### 变量与容器

​	前面絮絮叨叨那么多，算是走马观花了，毕竟你还不知道，你可以在Rust使用什么类型的变量！所以，平心而论，你现在甚至都不会赋值特定的类型给某变量名！

​	其他语言想要精细操作变量，需要包或别名的辅助：

```C/C++/Java/Python
UInt a = 233; -> UInt32 a = 233;
unsigned int a = 233; -> uint32_t a = 233;
a = 233; -> a = ctype_uint32(233);
# 等等等，可以看到，语言默认支持的int等等类型会随着ARCH变化而变化，比如：
# 	`match=ilp32`的`long`和`match=lp64`的`long`位长就不一致
#	如果是在资源充足的机子上，32位和64位也没什么区别，但是在资源有限的板子上，那就有大问题了！
```

​	所以，Rust的变量类型默认是：`[符号类型][位长]`，比如：`u32`，`i64`，`f128`等等

​	特殊的内置类型：`str - "你写的字符串常量"`，以及`ARCH`决定位长的：`isize/usize`，以及熟悉的`bool`

​	至于String，那是核心库自带且自动导入的特殊容器，用来进行快捷的字符序列操作！

​	容器是什么？能吃吗？容器可以看作一个包，里面装着基本变量或嵌套的容器。内置的容器有两种：`Array/Tuple`，如果你是混沌中立玩家，那么`struct/enum`也是容器，但是`s/e`将会在之后说明，非内置的常用容器会在最后举例说明一下。

```rust
// 内置容器的赋值会尝试逐一复制成员变量，复制未实现CT的不成功会转移所有权！此时剩余的变量可继续使用。
// Tuple：可以存不同类型，不可变，定长
let a = ("heke", 1228, 2003)

a.0 == "heke"
a.1 ==  1228

类型标签：a: (str, u32, u32)

// Array：所有元素单一类型，不可变，等长
let b = [1, 2, 3];

b[1] == 1
b[2] == 2

类型标签：b: [u32; 3]  // 长度为3的数组，类型都是u32
同值初始化的数组：[0, 0, 0] == [0; 3] // 初始化3个0
```



常用非内置容器：

​	利用结构体/枚举/基本变量/内置容器实现的种种数据结构与算法中的老朋友：`Vec-向量/变长数组`，`Deque-双端队列`，`Stack-栈`，`List-链表`，`HashMap-字典/键值对映射`，`BTreeMap-字典另外一种实现`，`BTreeSet-集合`，`HashSet-集合`，`String-变长字符串`等等

​	数量依据标准库/第三方库/版本而变化，详见`src`的官方文档。但是也简单介绍一下`Vec`，毕竟，常见的数据结构和算法无非就`增删改查`四种操作，有人习惯`push/pop`，有人习惯`append/remove`，有的还是`add/del`，所以，更多的使用方式，直接看官文！

```rust
let mut a = vec![1, 2, 3];   // 使用宏，初始化一个Vec<i32>的容器
let mut b = Vec::new();
b.push(1); b.push(2); b.push(3);  // b现在和a一致了！

for i in b {
    println!("{}", i);		 // 绝大多数容器都是Iter，看具体的实现，Iter见下面：迭代器相关
}
```



### 结构体相关

前面已经初步介绍过结构体了，这里更像是一个结构体相关的合集。

```rust
struct EMM {
    pub public_attr: type,		// 由于Rust整体是一个保守的语言，公共字段需要手动+pub前缀
    privite_attr: type,			// 默认的字段是私有的
}

impl EMM {
    fn show_self(&self) {
        // 自己的方法，自己的属性，私有公有皆可访问！
        println!("public_attr: [{}], privite_attr: [{}]", self.public_attr, self.privite_attr);
    }
    
    pub fn show(&self) {
        self.show_self();
    }
}

fn show_emm(emm: EMM) {
    emm.show_self();		// 报错！Panic！因为show_self是私有方法！！！
    emm.show();				// 这个就ok了！因为show是pub方法！！！
}
```

数据结构体与生命周期：

``` rust
// 前面已经介绍过了，生命周期的写法，这里赘述一下，顺便加上泛型：
struct tmp<T, 'emm> {
    attr1: &'emm T,
    attr2: &'static T,
    attr3: Box<dyn TraitName>,		// dyn是动态分配，这里露个面，详见下面的“杂七杂八”
    attr4: EMM,						// 上面的结构体，定大小的非递归结构体，不定大小的字段需要用指针包裹！
    attr5: EnumTmp,					// 枚举
    attr6: Vec<T>,
    attr7: BTreeMap<u8, T>,
}
```

元组结构体：

``` rust
struct emm (u8, pub u32, f64);
// 为什么emm，233？因为大部分文档太过正式，很多入门者搞不清后面的东西是关键字还是用户自定义的标签
// 比如一个struct StructName，你会错把StructName当关键字，但是Emm就不会，国外的相比于emm好像更喜欢foo
// ---
// 我们把元组结构体展开：
struct emm (
    u8,			// 使用方式和元组一致：obj.0 obj.1
    pub u32,	// 只有emm.1这个字段是pub，其余的.0 .2都是私有的
    f64
);

impl emm {
    pub fn show_emm(&self) {
        println!("Emm: [{}] [{}] [{}]", self.0, self.1, self.2);
    }
}
```



### 枚举相关

​	在底层玩家的眼中，枚举可以说是最有用最常用的语法，因为很多人都是基于状态机来写板子的，标识这些状态最好的方法就是使用枚举。比如常见的电风扇：开机，1档，2档，3档，关机；空调：开窗，半开窗，全开窗，摆动开窗等等。当你使用常量作为这些状态标识的时候，你会发现你想加一个1/4开窗，你得STFSC，看看前几个状态都是几，然后match...case：

```c
#include <some32.h>
int STAGE_A = 0;
int STAGE_B = 1;
int STAGE_C = 233;	// 很多人不想看源码了，写中间加状态的时候就慢慢写飘了
int STAGE_D = 666;	// 然后，简单的小板子还可以，状态多了迟早会出错
int STAGE_I_DONT_KNOW_WHAT_IS_THIS_STAGE = 3;	// 甚至半路，状态名称也变的奇奇怪怪
int I_WILL_BE_FOGET = 5;						// 还有定义了状态半路忘记处理的，导致状态悬空

int loop() {
    switch curr_stage {
        case 233:
        	xxxx;
        	break;
        case STAGE_C:
            xxx;
            break;
        default: ...
    }
}
// 优良的代码习惯，让短短百行代码变的难以维护...
```

Rust的强制Match的枚举就来了！他规定必须处理枚举的所有可能，在模式匹配的强大配合下，变的更加强大！

``` rust
enum EnumTmp {
    a, b, c, d = 233,
    e, StructEMM<T>, Option<u8>,
}
fn random_choose_a_state() -> EnumTmp;
// 因为枚举一用全用，所以当enum前声明权限pub的时候，所有的字段都是pub，这不同于struct
fn main() {
    let state = random_choose_a_state();
    match state {
        a => println!("匹配到a，每个语句使用逗号分割！"),
        233 => println!("匹配到233，实际上是d"),
        StructEMM {attr1: x, attr2} => {	// attr2: attr2缩写为：attr2，attr1别名为x
            println!("匹配到结构体，其中struct.attr1是{}，attr2是{}", x, attr2);
        },
        _ => println!("下划线匹配剩余的情况！"),
    }
}
```



### 绑定方法

懂得了结构体、枚举的声明，现在要给他们附加方法，不然他们只是数据，实际操作起来多多少少不方便！

```rust
impl Copy for StructEmm {
    fn clone ...;			//	为结构体StructEmm实现Copy Trait
}

trait SomeFunc {
    fn emm() { ... }		// 有函数体的特质方法即：方法的默认实现，给结构体实现/绑定的时候不要求必须实现
    pub fn emm233() { ... }
    fn qwq();				//	此方法没有默认实现，所以实现的时候必须实现
}

impl SomeFunc for StructEmm { ... }

trait AnyFunc: SomeFunc + Copy {	// AnyFunc特质要求实现的结构体必须先实现SomeFunc和Copy特质
    fn emm() { ... }		//	出现同名方法！
}

impl StructEmm {
    fn emm() { ... }		//	出现同名方法！
}

// 同名方法使用会首先查找默认实现，即`impl 结构体名字`下的方法，其次会寻找唯一实现
// 找不到就得使用特质签名手动调用了：
AnyFunc::emm(obj);			// obj的AnyFunc下的emm调用，若为唯一，则为：obj.emm()
```



### 模式匹配

Rust等等高级语言最令人讨喜的高级语法！首先将介绍基本的模式匹配用法，后将介绍可用在哪。

基本用法：

```rust
let a = 1;
let (a, b) = (1, 2);
let [a, b] = [1, 2];
let Some(a) = Some(123);
let StructEmm {attr1: x, attr2} = StructEmm {attr1: 123, attr2: 233};
```

条件守卫：

```rust
// 主要用在match：
let tmp = 233;
match obj {
    1 | 2 | 3 => println!("匹配到了1或2或3"),
    4 | 6 if tmp == 233 =>  println!("在tmp是233的时候匹配4或者5"),
    7..9 => println!("匹配到了range(7, 9) -> [7, 9)的数字之一"),
    'a'..='f' => println!("匹配到了['a', 'f']的字母之一，范围匹配只允许数字字母"),
    Some(x) @ 233 => println!("匹配到了Some(233)，此时x是233"),
    Some(x) => println!("Some(x)，因为x是233的情况在前面，所以这里的x不可能是233"),
    _	=> println!("匹配任意变量，_不会绑定值，_开头的变量允许逃过必须使用的检查，如果是x=>...则任意其余的值会绑定x"),
}
```

可用在哪：

```rust
let Mode(a) = mode;
if let Mode(a) = mode {
    println!("匹配的时候执行这里");
} else {
    println!("其余情况到这里，else可选");
}
while let Mode(a) = queue.pop() { ... }
for Mode(a) in IterMode { ... }
match ... case ... => ...
```



### 多态详解

Rust的多态是基于泛型的，编译时多态为了节省运行时时间，会根据方法的使用情况生成对应的衍生体，运行时多态是在编译时多态不能确定的时候，留到运行时动态分发的：

```rust
struct tmp<T,Y> {
    a: T,
    b: Y,
}
// 当你有：
tmp {a: 1u32, b:1u32}
tmp {a: 1i32, b:1f64}
// 的时候，编译时静态分发会生成struct tmpu32u32 { u32, u32 }和struct tmpi32f64 { i32, f64 }
// trait的多态方法也是，会自动在编译时生成对应版本，运行时就会节省判断类型再分发的消耗
// 如果你不确定有哪些方法会被使用，你需要提前给类型一点约束：
struct tmp<T: Copy+Tmp,Y> {	// T必须是实现了Copy和Tmp特质的类型
    a: T,
    b: Y,
}
impl<T> tmp<T> {	// 前一个T标识后面的T是类型名称
    fn func<T>() -> impl Copy + Tmp {		// impl标识返回的是实现了Copy + Tmp的一个type的工厂函数
        ...
    }
}
```

但是，如果就是不确定，非等得到运行时才能确定结构体的类型怎么办？运行时动态分发：

``` rust
struct tmp<Y> {
    a: Box<dyn Copy+Tmp>,		// dyn标识此字段将会是一个实现了Copy+Tmp特质的类型
    b: Y,
}
```

动态分发不会自动生成多个适应不同类型的结构体衍生，也就是说编译时优化不了，在运行的时候，会浪费一点资源判断类型后分发。

上面发现写类型前面有点冗长，有点乱了，所以可以使用`type`来定义类型，`where`定义约束：

``` rust
// type 类似于C语言的typedef
type emm = u32;
type qwq = crate::collections::HashMap;
type asd = ref Vec<u8>;
type zxc<T> = tmp<T,T>;

// 类型约束：
impl<T> xxx<T: crate::collections::HashMap, F: [u32; 64]> { ... }
// 可写为：
impl<T,F> xxx<T,F> 
where 
	T: crate::collections::HashMap,
	F: [u32; 64]
{ ... }

// 当然，如果impl/mod里面书写类型过于麻烦，也可以内部定义类型，类似于临时起个别名：
impl Tmp {
    type type_a = [u8; 64];
    fn emm(var1: type_a, var2: type_a) -> type_a {
        ...
    }
}
```



### 智能指针

智能指针是一个个可以解引用对象的封装，他们的功能块可以像乐高积木一样堆叠拼装

```rust
use std::rc::Rc;
use std::cell::RefCell;
use std::sync::{Arc, Mutex};

fn smart_pointers() {
    // Box - 堆分配，单一所有者
    let boxed = Box::new(5);
    println!("Box: {}", *boxed);

    // Rc - 引用计数，多所有者
    let rc1 = Rc::new("shared".to_string());
    let rc2 = rc1.clone();
    println!("Rc count: {}", Rc::strong_count(&rc1));

    // RefCell - 内部可变性
    let refcell = RefCell::new(42);
    *refcell.borrow_mut() += 1;
    println!("RefCell: {}", refcell.borrow());

    // Arc + Mutex - 线程安全的共享状态
    let arc_mutex = Arc::new(Mutex::new(0));
    let clone = arc_mutex.clone();
    *clone.lock().unwrap() = 10;
    println!("Arc+Mutex: {}", *arc_mutex.lock().unwrap());
}
```



### 包管理相关

合理分割代码，合理安排代码位置，是熟悉设计模式的码农必需品。写完不仅仅心旷神怡，`debug`的时候也可以更快的定位`bug`！
```shell
cargo new 包名 --bin / --lib
# 其中，默认为 --bin ，创建二进制程序，二进制程序就是含有程序入口 main 的程序
# --lib 为创建一个包，类似于Py的 __init__.py
```


```rust
// 假设的包结构
/*
my_crate/
├── Cargo.toml
├── src/
│   ├── lib.rs        // 主要库文件
│   ├── utils.rs      // 工具模块
│   └── network/      // 子模块
│       ├── mod.rs
│       └── tcp.rs
*/

// src/lib.rs 示例
pub mod utils;
pub mod network;

// 使用pub use重导出，将 TcpConnection 导出至当前主命名空间
pub use network::tcp::TcpConnection;		// 类似于：from network.tcp import TcpConnection

// Cargo.toml 依赖示例
/*
[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.0", features = ["full"] }
*/
```

包的发布：

在[crates.io](crates.io)创建用户，生成API Token，使用命令行登录

```shell
cargo login <API_TOKEN>
```

在自己想要发布的包中，确认包含入以下字段：

```toml
[package]
name = "your-package"  # 必须唯一，全小写+连字符
version = "0.1.0"      # 遵循语义化版本 (SemVer)
description = "随意简要描述即可"
license = "MIT/Apache-2.0"  # 必须使用 SPDX 标识符
authors = ["XXX@example.com", "可以有多个作者，逗号隔开"]
repository = "https://github.com/your/repo"  # 可选但推荐
```

打包和[发布](https://doc.rust-lang.org/cargo/)：

```shell
cargo package  # 本地生成 .crate 文件（位于 target/package/）

cargo publish --dry-run  # 模拟发布，检查潜在问题
cargo publish  # 上传到 crates.io
```

---

如果想在本地引入本地/Git途径的包：

```toml
[dependencies]
your_lib = { git = "https://github.com/user/repo", branch = "main" }   # Git
your_lib = { path = "../local-path" }                                  # 本地
```



### 异步相关

Rust的异步传输数据，一种是靠原子性的Arc/Mutex等等智能指针来查改值，一种是靠通信管道来传输值：

```rust
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

// 使用 Arc<Mutex> 共享状态
async fn shared_state_example() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        handles.push(tokio::spawn(async move {
            let mut num = counter.lock().await;
            *num += 1;
        }));
    }

    for handle in handles {
        handle.await.unwrap();
    }
    println!("Result: {}", *counter.lock().await);
}

// 使用通道通信
async fn channel_example() {
    // 其中管道常见的操作是使用Arc共享，之后使用move闭包传入
    let (tx, mut rx) = mpsc::channel(32);
    
    tokio::spawn(async move {
        tx.send("Hello from task").await.unwrap();
    });

    println!("Received: {:?}", rx.recv().await);
}

#[tokio::main]
async fn main() {
    shared_state_example().await;
    channel_example().await;
}
```



多进程示例：

```rust
use std::process::Command;
use std::thread;
use std::time::Duration;

fn process_example() {
    // 启动子进程
    let child = Command::new("ls")
        .arg("-l")
        .spawn()
        .expect("Failed to start process");

    println!("Parent waiting...");
    thread::sleep(Duration::from_secs(1));
    
    // 等待子进程结束
    let output = child.wait_with_output().unwrap();
    println!("Process exited with: {:?}", output.status);
}
```



多线程示例：

```rust
use std::sync::mpsc;
use std::thread;

fn thread_example() {
    // 创建线程间通道
    let (tx, rx) = mpsc::channel();

    // 生成线程
    thread::spawn(move || {
        tx.send("Message from thread").unwrap();
    });

    // 主线程接收消息
    println!("Got: {}", rx.recv().unwrap());
    
    // 线程池示例
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(4)
        .build()
        .unwrap();

    pool.spawn(|| println!("Running in thread pool"));
}
```



协程示例（使用[Tokio](https://tokio-zh.github.io/)）：

```rust
use tokio::task;
use std::time::Duration;

async fn coroutine_example() {
    // 生成异步任务（协程）
    let handle = task::spawn(async {
        tokio::time::sleep(Duration::from_secs(1)).await;
        "Task completed"
    });

    // 等待任务完成
    println!("{}", handle.await.unwrap());
    
    // 并行执行多个协程
    let futures = vec![
        task::spawn(async { 1 }),
        task::spawn(async { 2 }),
        task::spawn(async { 3 }),
    ];
    
    let results = futures::future::join_all(futures).await;
    println!("Results: {:?}", results);
}

#[tokio::main]
async fn main() {
    coroutine_example().await;
}
```





### 宏编程

rust的宏编程包括简单的声明宏和高级的过程宏，声明宏使用`macro_rules!`声明；过程宏则是基于语法树进行操作。

声明宏示例：

```rust
#[macro_export]   // 默认宏只能在定义的命名空间使用，除非定义宏可导出！
macro_rules! outputlns {
    ($($val:expr),+) => {
        {
            // 由于使用*匹配多个val，则需要在需要重复生成的语句后加 + 来重复生成
            println!("{}", val);+
        }  // 更常见的是整个语句块后重复生成多个语句，匹配参数数量的除了 + 还有 * ?
    };  // 每个匹配规则后记得加封号！
    () => {
        println!("这是没有参数的空语句！");
    };
}

// 调用宏：
outputlns!();   // 同样可以使用 outputlns![];  outputlns!{};
```

过程宏示例：
```rust
// 过程宏的导出需要专门的crate导出：
/// Cargo.toml：
/// [dependencies]
/// proc-macro2 = "1.0"
/// [lib]
/// proc-macro = true

use proc_macro::TokenStream;

#[proc_macro_derive(MyDerive)]
pub fn my_derive(input: TokenStream) -> TokenStream {
    let input = syn::parse_macro_input!(input as syn::DeriveInput);
    let name = input.ident;
    
    quote::quote! {
        impl #name {
            pub fn generated_fn() {
                println!("Generated for {}!", stringify!(#name));
            }
        }
    }.into()
}
```

查看宏展开：

```shell
cargo expand --test your_lib
```



### 网络编程

#### TCP/UDP

TCP示例：

```rust
use std::net::{TcpListener, TcpStream};
use std::io::{Read, Write};

fn handle_client(mut stream: TcpStream) {
    let mut buffer = [0; 1024];
    stream.read(&mut buffer).unwrap();
    stream.write(b"HTTP/1.1 200 OK\r\n\r\nHello from TCP!").unwrap();
}

fn main() {
    let listener = TcpListener::bind("127.0.0.1:8080").unwrap();
    for stream in listener.incoming() {
        handle_client(stream.unwrap());
    }
}
```

UDP示例：

```rust
use std::net::UdpSocket;
fn main() {
    let socket = UdpSocket::bind("127.0.0.1:8080").unwrap();
    let mut buf = [0; 1024];
    let (amt, src) = socket.recv_from(&mut buf).unwrap();
    socket.send_to(&buf[..amt], src).unwrap();
}
```



#### Http

网络请求示例：

```rust
use reqwest::blocking; // 非异步注意使用 blocking 模块

fn main() -> Result<(), reqwest::Error> {
    let client = blocking::Client::new();
    
    let response = client.get("https://httpbin.org/get").send()?;
    println!("Status: {}", response.status());
    println!("Body: {}", response.text()?);
    
    Ok(())
}

--- 异步方案 ---

use reqwest;

#[tokio::main]
async fn main() -> Result<(), reqwest::Error> {
    let response = reqwest::get("https://httpbin.org/get").await?;
    println!("Status: {}", response.status());
    println!("Body: {}", response.text().await?);
    Ok(())
}
```



#### Web

常见的Web空间目前[2024.09]有：[Rocket](https://rocket.rs/)，[Actix](https://actix.rs/)，[Axum](https://github.com/tokio-rs/axum)，[Poem](https://github.com/poem-web/poem)，[Salvo](https://salvo.rs/)等等；可以先入为主尝试`Rocket`和`Poem`！

```rust
#[macro_use] extern crate rocket;

#[get("/")]
fn index() -> &'static str {
    "Hello, Rocket!"
}

#[get("/hello/<name>?<age>")]
fn hello(name: String, age: Option<u8>) -> String {
    format!("Hello, {}! Age: {:?}", name, age)
}

#[launch]      // 旧版使用main函数中：rocket::ignite().mount("/hello", routes![hello]).launch();...
fn rocket() -> _ {
    rocket::build().mount("/", routes![index, hello])
}

--- Json序列化对象 ---

use rocket::serde::{json::Json, Deserialize};

#[derive(Deserialize)]
struct User {
    name: String,
    age: u8,
}

#[post("/user", data = "<user>")]
fn create_user(user: Json<User>) -> String {
    format!("Created user: {} (age {})", user.name, user.age)
}

--- WebSocket ---

use rocket::tokio::net::TcpStream;
use rocket::response::stream::TextStream;

#[get("/ws")]
fn ws() -> TextStream![] {
    TextStream! { yield "Connected to WebSocket!" }
}
```



### 系统编程

#### 系统调用

使用[`libc`](https://docs.rs/libc/latest/libc/)库来直接使用系统调用函数：

```rust
use libc::{c_int, open, O_RDONLY};
let fd = unsafe { open("file.txt\0".as_ptr() as *const i8, O_RDONLY) };
```

在linux平台可以使用`nix`封装，在win系统可以使用`winapi`封装。

不同平台可以使用`#[cfg(target_os = "linux")]`类似的条件编译来编写跨平台代码……



#### 内核编程

可参考：[Rust OSDev](https://github.com/rust-osdev)



#### 杂七杂八

##### 与C交互

Rust端声明：

```rust
#[repr(C)]   // 使得结构体满足C样式，不会自动优化结构体字段顺序
pub struct Counter {
    value: i32,
}

impl Counter {
    #[no_mangle]  // 禁止名称修饰
    pub extern "C" fn new() -> *mut Counter {
        Box::into_raw(Box::new(Counter { value: 0 }))
    }
    
    /// 也可以自己设置导出名：
    /// #[export_name = "custom_name"]

    #[no_mangle]
    pub extern "C" fn increment(counter: *mut Counter) {
        unsafe { &mut *counter }.value += 1;
    }

    #[no_mangle]
    pub extern "C" fn get_value(counter: *const Counter) -> i32 {
        unsafe { &*counter }.value
    }

    #[no_mangle]
    pub extern "C" fn destroy(counter: *mut Counter) {
        unsafe { Box::from_raw(counter) };
    }
}
```

C端调用：

```C
typedef struct Counter Counter;

Counter* counter_new();
void counter_increment(Counter*);
int counter_get_value(const Counter*);
void counter_destroy(Counter*);

int main() {
    Counter* c = counter_new();
    counter_increment(c);
    printf("Value: %d\n", counter_get_value(c));
    counter_destroy(c);
    return 0;
}
```

---

C端声明：

```c
// example.h
#include <stdio.h>

typedef struct {
    int x;
    int y;
} Point;

Point c_create_point(int x, int y);
void c_print_point(const Point* p);
```



Rust端调用：

```rust
// build.rs 确保链接C库
fn main() {
    println!("cargo:rustc-link-lib=dylib=example");
}

// src/main.rs
#[repr(C)] // 保证内存布局与C兼容
pub struct Point {
    x: i32,
    y: i32,
}

extern "C" {
    // 声明外部C函数
    fn c_create_point(x: i32, y: i32) -> Point;
    fn c_print_point(p: *const Point);
}

fn main() {
    let p = unsafe { c_create_point(10, 20) };
    unsafe { c_print_point(&p as *const Point) };
}
```



---

需要注意：C的字符串以`\0`结尾，Rust则没有，所以互相传递的时候可以使用`std::ffi::CString`

自动绑定工具：`Rust -> C: cbindgen`，`C -> Rust: bindgen`



##### 嵌入汇编

假设有一个`add_sub.S`的汇编文件：

```assembly
.section .text.entry
.globl _add_and_subtract
.type _add_and_subtract, %function

_add_and_subtract:
    # 获取参数
    addi    sp, sp, -16       # 为局部变量分配栈空间
    sd      a0, 0(sp)         # 保存第一个参数到栈
    sd      a1, 8(sp)         # 保存第二个参数到栈

    # 读取参数
    ld      t0, 0(sp)         # 加载第一个参数
    ld      t1, 8(sp)         # 加载第二个参数

    # 执行加法
    addi    t2, t0, t1        # t2 = t0 + t1

    # 执行减法
    subi    t3, t0, t1        # t3 = t0 - t1

    # 返回值
    sd      t2, 16(sp)        # 保存加法结果到栈上的返回位置
    sd      t3, 24(sp)        # 保存减法结果到栈上的返回位置

    # 加载返回值地址
    la      a0, 16(sp)        # 第一个返回值地址
    la      a1, 24(sp)        # 第二个返回值地址

    # 恢复栈指针
    addi    sp, sp, 16        # 恢复栈指针
    ret
```

使用Rust编写/操作/调用汇编的简易示例：

```rust
#![feature(abi_riscv_call)]

extern "riscv-call" {
    fn add_and_subtract(a: i64, b: i64) -> (i64, i64);
}

#[no_mangle]
pub extern "C" fn _start() -> ! {  // 裸机环境，直接定义入口函数 _start
    let a: i64 = 10;
    let b: i64 = 5;

    unsafe {
        let (sum, diff) = add_and_subtract(a, b);
        println!("Sum: {}, Difference: {}", sum, diff);
    }
}
```

需要注意：裸机环境只有核心库`core`，`#![no_main]`且`#![no_std]`，所以常用的`println!`需要根据设备特性(uart/lcd/Serial.write)自己封装！

使用`asm!`宏嵌入汇编：

```rust
#![no_std]
#![no_main]

use core::arch::asm;   // 也可以：#![feature(asm)]
use core::panic::PanicInfo;

// 定义RISC-V系统调用号
const SYS_WRITE: usize = 64;
const SYS_EXIT: usize = 93;

// 系统调用包装函数
unsafe fn syscall(syscall_num: usize, arg0: usize, arg1: usize, arg2: usize) -> usize {
    let ret: usize;
    asm!(
        "ecall",
        in("a7") syscall_num,
        inlateout("a0") arg0 => ret,
        in("a1") arg1,
        in("a2") arg2,
        options(nostack)
    );
    ret
}

// 打印字符串到标准输出
fn print_str(s: &str) {
    unsafe {
        syscall(SYS_WRITE, 1, s.as_ptr() as usize, s.len());
    }
}

// 退出程序
fn exit(code: usize) -> ! {
    unsafe {
        syscall(SYS_EXIT, code, 0, 0);
    }
    loop {}
}

// 计算阶乘的汇编实现
fn factorial(n: usize) -> usize {
    let mut result: usize = 1;
    let mut i: usize = n;
    
    unsafe {
        asm!(
            "1:",                    // 标签1
            "beqz {i}, 2f",          // 如果i==0，跳转到标签2
            "mul {result}, {result}, {i}",
            "addi {i}, {i}, -1",      // i--
            "j 1b",                   // 跳回标签1
            "2:",                     // 标签2
            i = inout(reg) i,
            result = inout(reg) result,
            options(nostack)
        );
    }
    
    result
}

// 内存操作示例
fn memory_operations() {
    let mut array: [u32; 4] = [10, 20, 30, 40];
    let mut sum: u32 = 0;
    
    unsafe {
        asm!(
            // 加载array[0]到t0
            "lw t0, 0({ptr})",
            // 加载array[1]到t1
            "lw t1, 4({ptr})",
            // 相加
            "add t0, t0, t1",
            // 加载array[2]到t1
            "lw t1, 8({ptr})",
            // 相加
            "add t0, t0, t1",
            // 加载array[3]到t1
            "lw t1, 12({ptr})",
            // 相加
            "add {sum}, t0, t1",
            ptr = in(reg) array.as_ptr(),
            sum = out(reg) sum,
            options(nostack)
        );
    }
    
    print_str("Array sum: ");
    print_uint(sum as usize);
    print_str("\n");
}

// 打印无符号整数
fn print_uint(mut num: usize) {
    let mut buffer = [0u8; 20];
    let mut i = 0;
    
    if num == 0 {
        buffer[i] = b'0';
        i += 1;
    } else {
        while num > 0 {
            buffer[i] = (num % 10) as u8 + b'0';
            num /= 10;
            i += 1;
        }
        buffer[..i].reverse();
    }
    
    print_str(unsafe { core::str::from_utf8_unchecked(&buffer[..i]) });
}

// 主函数
#[no_mangle]
pub extern "C" fn _start() -> ! {
    print_str("RISC-V Assembly in Rust\n");
    
    // 寄存器操作示例
    let a = 5;
    let b = 7;
    let mut c: usize;
    
    unsafe {
        asm!(
            "add {0}, {1}, {2}",
            out(reg) c,
            in(reg) a,
            in(reg) b,
            options(nostack)
        );
    }
    
    print_str("5 + 7 = ");
    print_uint(c);
    print_str("\n");
    
    // 阶乘示例
    let n = 5;
    let fact = factorial(n);
    print_str("5! = ");
    print_uint(fact);
    print_str("\n");
    
    // 内存操作示例
    memory_operations();
    
    // 退出程序
    exit(0);
}

// 恐慌处理
#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    print_str("Panic occurred!\n");
    exit(1);
}
```



---
