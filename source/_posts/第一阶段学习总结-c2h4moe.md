---

title: 第一阶段学习总结-c2h4moe
date: 2024-04-28 20:39:13
tags:
---

经过第1个阶段的学习，我对rust语法有了基本的了解。

rust这门语言以难著称，同时又以内存安全闻名，这导致一些初学者（比如我）在开始学习时有一种“神化”编译器的倾向，认为rust能纠出这么多的错误一定在于有什么“神秘”的静态分析法能够准确的分析内存的使用，借用，修改，释放等等。一些糖化了的语法也阻碍了我的理解。经过这一个月的学习，我慢慢明白rust并没有什么魔法，其能够在编译期检查出如此多的潜在错误，完全得益于rust最大的特色——所有权系统。编译器只是无情的对一切不符合所有权规则和借用规则的代码报错，在这其中只不过“恰好”消灭了大部分bug的存在罢了。

## 所有权与借用

rust中，每一个值都有一个“所有者”，与C++需要程序员手动管理内存不同，rust以“谁拥有，谁负责”的原则，当变量离开作用域时，变量所拥有的内存就会被释放，这个机制阻断了由于粗心导致忘记释放或二次释放的bug的机会。

与所有权相关的一个重要概念就是“借用”，在其他语言里，就是引用的意思，但rust会对引用做语言层面的检查，一个是**在任意给定时间，要么只能有一个可变引用，要么只能有多个不可变引用**，还有一个是**引用必须总是有效的**。rust对借用的严格检查从语言层面避免了数据竞争和访问悬垂引用，而这两个是在C++中极易犯下的错误。

比如，在C++中很容易犯下这样的错误。

```c++
vector<int> arr(2,0);
int i=0;
for(auto it = arr.begin(); it != arr.end(); it++) {
    if(i == 1) arr.push_back(2);
    cout<<*it<<' ';
    i++;
}
```

由于push_back导致了迭代器失效，这段代码行为是很难预测的。但是如果在rust中写出对应的代码如下

```rust
let mut arr = vec![1, 2, 3];
let mut i = 0;
for elem in &arr {
    println!("{}",elem);
    if i == 1 {
        arr.push(6);
    }
    i += 1;
}
```

编译器会拒绝通过，报错如下。

```rust
error[E0502]: cannot borrow `arr` as mutable because it is also borrowed as immutable
  --> src\main.rs:38:13
   |
35 |     for elem in &arr {
   |                 ----
   |                 |
   |                 immutable borrow occurs here
   |                 immutable borrow later used here
...
38 |             arr.push(6);
   |             ^^^^^^^^^^^ mutable borrow occurs here

```

可以看到，rust确实从语言层面减少了很多写出错误代码的机会，但对于上面的例子，想要说清楚为什么，（我认为）并不容易。

首先for语句只是一个语法糖，将其展开，可以等价于以下形式（由于i并不重要，这里就省略它）。

```rust
let mut it = (&v).into_iter();
loop {
    match it.next() {
        Some(x) => {
            v.push(6);
        },
        None => {
            break;
        }
    }
}
```

如果从借用规则来检查上面代码，也许会觉得完全正确，v.iter虽然借用了v，但函数返回后应该这个借用就失效了，只是返回了一个新的迭代器对象，后面v.push重新可变借用v，应该是完全没问题的，那么为什么编译器会告诉我们违反了借用规则？

查阅std文档中Vec的into_iter函数，发现函数原型为`fn into_iter(self) -> <&'a mut Vec<T, A> as IntoIterator>::IntoIter`，而IntoIter是`IterMut<'a, T>`，所以我们调用(&v).into_iter()相当于

```rust
into_iter(&'a mut Vec<i32>) -> IterMut<'a, i32>
```

原来代码等价于如下形式。

```rust
'a {
    let mut it: IterMut<'a, i32> = into_iter(&'a mut arr);
    'b {
        loop {
            match it.next() {
                'c {
                    Some(x) => 
                    {Vec<i32>::push(&'c mut arr, &6);},
                }
                'd {
                    None => {break;}
                }
            }
        }
    }
}
```

由于into_iter的函数签名要求参数即对arr可变借用的生命周期与返回值一致，而返回值由于和it绑定，生命周期就是'a，那么相当于对arr的可变借用的生命期也是'a，而后续又有了一个生命期为'c的arr可变借用，且'c与'a有重叠，这样就违反了**在任意给定时间，要么只能有一个可变引用，要么只能有多个不可变引用**的规则，所以rust编译器会报错（也有可能我的理解是错误的，请大家多指正）

有了这样的分析思路，接下来下面的两段代码也可以很方便的分析出报错原因。

```rust
let mut arr = vec![1, 2, 3];
swap(&mut arr[0], &mut arr[1]);
```

显然&mut arr[0]和&mut arr[1]的生命期有重叠，而arr[...]只不过是`fn index_mut(&'a mut self, index: I) -> &'a mut <Vec<T, A> as Index<I>>::Output`的语法糖，由刚才的分析规则，很容易能够明白为何编译器报错。

下面的示例留给读者练习。

```rust
let mut b = 3;
let c;
{
    let x = &mut b;
    c = &*x;
}
let d = &b;
println!("{}",c);
```

## 什么时候会发生移动

开始学习时这个问题困扰着我，因为有一次发现一条语句什么都不做：

```rust
x;
```

x的值也会被移动，从此以后甚至不敢在表达式中写变量名，生怕一下子就被移动走了。但其实这个困惑还是因为reference读的少了导致的。reference中对表达式进行了分类，分为值表达式和位置表达式，除了极少量位置表达式，其它都是值表达式，而若一个位置表达式在值表达式上下文中被求值时，才会发生复制或移动（根据是否实现copy trait）。

具体的请看[reference: expression](https://rustwiki.org/zh-CN/reference/expressions.html)

另外，原来比较两个值大小（比较运算符表达式）会对两个操作数在位置表达式上下文求值，这样就不用比较两个值大小还要先clone了（我之前竟然是这么干的......）

印象比较深的主要就是以上两个，有可能理解还是有偏差，请大家多指正。

我查阅的一些资料如下：

[1] [reference: expression](https://rustwiki.org/zh-CN/reference/expressions.html)

[2, 3] [rustnomicon: lifetimes](https://doc.rust-lang.org/nomicon/lifetimes.html), [rustnomicon: limits of lifetimes](https://doc.rust-lang.org/nomicon/lifetime-mismatch.html)

[4] [rust-std](https://rustwiki.org/zh-CN/std/vec/struct.Vec.html)

[5] [course.rs: 深入生命周期](https://course.rs/advance/lifetime/advance.html)









