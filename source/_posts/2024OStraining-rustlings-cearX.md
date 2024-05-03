---
title: <2024OStraining-rustlings-cearX>
date: 2024-04-28 23:49:01
tags:
---

Rust 程序设计语言能帮助你编写更快、更可靠的软件。在编程语言设计中，高层的工程学与底层的控制往往是难以兼得的；而 Rust 则试图挑战这一矛盾。通过平衡强大的技术能力与优秀的开发者体验，Rust 为你提供了控制底层细节（如内存使用）的选项，而无需承受通常与此类控制相关的所有繁琐细节。

Rust 适合那些渴望在编程语言中寻求速度与稳定性的开发者。对于速度来说，既是指 Rust 可以运行的多快，也是指编写 Rust 程序的速度。Rust 编译器的检查确保了增加功能和重构代码时的稳定性，这与那些缺乏这些检查的语言中脆弱的祖传代码形成了鲜明对比，开发者往往不敢去修改这些代码。通过追求零成本抽象（zero-cost abstractions）—— 将高级语言特性编译成底层代码，并且与手写的代码运行速度同样快。Rust 努力确保代码又安全又快速。

所有权规则
Rust 中的每一个值都有一个 所有者（owner）。
值在任一时刻有且只有一个所有者。
当所有者（变量）离开作用域，这个值将被丢弃

    {                      // s 在这里无效，它尚未声明
        let s = "hello";   // 从此处起，s 是有效的

        // 使用 s
    }                      // 此作用域已结束，s 不再有效


    {
        let s = String::from("hello"); // 从此处起，s 是有效的

        // 使用 s
    }                                  // 此作用域已结束，
                                       // s 不再有效


不变引用可以同时有多个（可以有多个读者）
不变引用存在的同时不能有可变引用（读者写者不能共存）
不能同时有多个可变引用（多个写者也不能共存）

字符串 slice（string slice）是 String 中一部分值的引用，它看起来像这样：

    let s = String::from("hello world");

    let hello = &s[0..5];
    let world = &s[6..11];
不同于整个 String 的引用，hello 是一个部分 String 的引用，由一个额外的 [0..5] 部分指定。
可以使用一个由中括号中的 [starting_index..ending_index] 指定的 range 创建一个 slice，
其中 starting_index 是 slice 的第一个位置，ending_index 则是 slice 最后一个位置的后一个值

vector
如果遍历过程中需要更改变量的值：
fn main() {
    let mut v = vec![100, 32, 57];
    for i in &mut v {
        *i += 50;
    }
}


    fn process(&mut self, message: Message) {
        // TODO: create a match expression to process the different message
        // variants
        // Remember: When passing a tuple as a function argument, you'll need
        // extra parentheses: fn function((t, u, p, l, e))
        match message {
            Message::ChangeColor(r, g, b) => self.change_color((r, g, b)),
            Message::Echo(String) => self.echo(String),
            Message::Move(Point) => self.move_position(Point),
            Message::Quit => self.quit(),
        }
    }


"blue".to_string()
字面量转化为字符串


fn trim_me(input: &str) -> String {
    // TODO: Remove whitespace from both ends of a string!
    String::from(input.trim())
}
fn compose_me(input: &str) -> String {
    // TODO: Add " world!" to the string! There's multiple ways to do this!
    input.to_string() + " world!"
}
fn replace_me(input: &str) -> String {
    // TODO: Replace "cars" in the string with "balloons"!
    input.to_string().replace("cars", "balloons")
}


fn main() {
    string_slice("blue");
    string("red".to_string());
    string(String::from("hi"));
    string("rust is fun!".to_owned());
    string("nice weather".into());
    string(format!("Interpolation {}", "Station"));
    string_slice(&String::from("abc")[0..1]);
    string_slice("  hello there ".trim());
    string("Happy Monday!".to_string().replace("Mon", "Tues"));
    string("mY sHiFt KeY iS sTiCkY".to_lowercase());
}

Option

fn main() {
    let opt = Option::Some("Hello");
    let opt2: Option<&str>= Option::None;
    match opt2 {
        Option::Some(something) => {
            println!("{}", something);
        },
        Option::None => {
            println!("opt is nothing");
        }
    }
}

if-let语法糖
let i = 0;
if let 0 = i {
    println!("zero");
} else{
   println!("not zero");
}


    for fruit in fruit_kinds {
        // TODO: Insert new fruits if they are not already present in the
        // basket. Note that you are not allowed to put any type of fruit that's
        // already present!
        if !basket.contains_key(&fruit) {
            basket.insert(fruit, 1);
        }
    }

    for fruit in fruit_kinds {
        // TODO: Insert new fruits if they are not already present in the
        // basket. Note that you are not allowed to put any type of fruit that's
        // already present!
        // 查询Yellow对应的值，若不存在则插入新值
        basket.entry(fruit).or_insert(1);
    }


        // Update the team 1 score
        let team_1 = scores.entry(team_1_name).or_insert(
            Team {
                goals_scored: 0,
                goals_conceded: 0,
            }
        );
        team_1.goals_scored += team_1_score;
        team_1.goals_conceded += team_2_score;
        // Update the team 2 score
        let team_2 = scores.entry(team_2_name.clone()).or_insert(
		  Team {
            goals_scored: 0,
            goals_conceded: 0,
        });
        team_2.goals_scored += team_2_score;
        team_2.goals_conceded += team_1_score;

quiz2 就是将 string及其指令 转化的过程


        for (string, command) in input.iter() {
            // TODO: Complete the function body. You can do it!
            let member = match command{
                Command::Uppercase => string.to_uppercase(),
                Command::Trim => string.trim().to_string(),//into()也可以，to_owned()也可以
                Command::Append(nums) => string.to_owned()+&"bar".repeat(*nums),//想寻找一个简单的写法，repeat就满足
            };
            output.push(member);
        }

to_string(), into(), to_owned(), from()区别是什么
一般直接使用to_owned()就好，因为很直观合理

&str -> String

把数据从栈中复制到堆中，成为自己的数据

options2：调用 pop 方法时，它会从数组的末尾移除一个元素，并返回被移除的元素作为 Option<T>。因此，在这个例子中，由于数组的类型是 Vec<Option<i8>>，所以 pop 方法返回的类型是 Option<Option<i8>>。外层的 Option 表示从数组中获取到的值，内层的 Option 表示数组中原本存储的 Option<i8> 类型的值。


fn main() {
    let y: Option<Point> = Some(Point { x: 100, y: 200 });
    match &y {
        Some(p) => println!("Co-ordinates are {},{} ", p.x, p.y),
        _ => panic!("no match!"),
    }
    y; // Fix without deleting this line.
}

match语句的所有权问题，编译器报错说最后一行的y的value已经被moved了，很明显是match使用后，离开作用域y就失效了。

其实 ? 就是一个宏，它的作用跟上面的 match 几乎一模一样：

let mut f = match f {
    // 打开文件成功，将file句柄赋值给f
    Ok(file) =>> file,
    // 打开文件失败，将错误返回(向上传播)
    Err(e) =>> return Err(e),
};
如果结果是 Ok(T)，则把 T 赋值给 f，如果结果是 Err(E)，则返回该错误，所以 ? 特别适合用来传播错误。


    #[test]
    fn item_quantity_is_an_invalid_number() {
        assert_eq!(
            total_cost("beep boop").unwrap_err().to_string(),
            "invalid digit found in string"
        );// unwrap_err()的意思是，将ok()或者Err()中的值取出来并报错
    }

main函数默认没有返回值，或者说返回值类型是()

let x: i64 = s.parse().map_err(ParsePosNonzeroError::from_parseint)?;

parse().unwrap()，这将会导致如果s不能解析为整数i64，就会直接panic掉，而使用map_err对Err()进行一些修改，捕获原本的ParseInt类型错误，而将它转化成ParsePosNonzeroError::ParseInt

这行代码的意思是，如果 s.parse() 解析成功，则将解析后的整数值赋值给 x；如果解析失败，? 操作符会立即返回并将 ParseIntError 转换为 ParsePosNonzeroError::ParseInt 错误，并将其作为 parse_pos_nonzero 函数的返回结果。

在 Rust 中，? 操作符用于简化错误处理的过程。它只能在返回 Result 或 Option 的函数中使用。当使用 ? 操作符时，编译器会自动为你处理错误的传播。

具体到代码中，s.parse() 返回的是一个 Result<i64, ParseIntError>，该结果表示解析字符串为整数的过程。如果解析成功，返回 Ok 包含解析后的整数值；如果解析失败，则返回 Err 包含一个 ParseIntError 错误。

泛型是个好东西

特征Trait
特征跟接口的作用类似
特征trait中只定义共同行为，但是不描述具体行为的实现，具体行为的实现交给符合该特征的具体类型中来实现

可以同时调佣两个特征中的方法

Rust 生命周期机制是与所有权机制同等重要的资源管理机制。

之所以引入这个概念主要是应对复杂类型系统中资源管理的问题。

引用是对待复杂类型时必不可少的机制，毕竟复杂类型的数据不能被处理器轻易地复制和计算。

简单来说，程序员如果对生命周期判断不好，就会引发程序的隐藏问题，并且很难被发现。而rust在编译器层次实现了生命周期的检查。与之适配的，为了通过生命周期检查，写rust的时候有时候需要手动标注生命周期（其他语言和此前的rust都是编译器自动推导生命周期）。

生命周期主要是解决悬垂引用问题。可以对生命周期进行下总结：生命周期语法用来将函数的多个引用参数和返回值的作用域关联到一起，一旦关联到一起后，Rust 就拥有充分的信息来确保我们的操作是内存安全的。

如果你询问一个 Rust 资深开发：写 Rust 项目最需要掌握什么？相信迭代器往往就是答案之一。无论你是编程新手亦或是高手，实际上大概率都用过迭代器，虽然自己可能并没有意识到这一点:)

迭代器允许我们迭代一个连续的集合，例如数组、动态数组 Vec、HashMap 等，在此过程中，只需关心集合中的元素如何处理，而无需关心如何开始、如何结束、按照什么样的索引去访问等问题。

