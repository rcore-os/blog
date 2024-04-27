---
title: 2024OS训练营第一阶段总结-SaZiKK
date: 2024-04-24 21:57:58
tags:
    - author:SaZiKK
    - repo:SaZiKK/rust-rustlings-2024-spring-SaZiKK
---

<div style="text-align: center; ">
  <img src="https://sazikk.github.io/assets/figures/avatar.jpg" alt="avetar" style="width: 25%; height: auto;">
</div>


## Rustling心得


Rustlings对于rust的上手帮助很大，~~不过它的难度比较松弛，而额外添加的10道算法题又弥补了这一部分~~。尽管如此，我在完成rustlings过程中还是遇到了很多问题和疑惑，解决这些问题让我对rust的理解提高了很多

### 24 vecs2
``` rust
fn vec_map(v: &Vec<i32>) -> Vec<i32> {
    v.iter().map(|element| {
        element*2
    }).collect()
}
```
在这里出现了map和collect方法。map和collect的搭配是rust非常常用的元素处理方法，代表对迭代器中的每一个元素都进行传入的闭包的操作，并最后collect进一个集合中，collect可以指定集合的类型，如`collect::<Vec<i32>>()`，非常的好用

### 39 strings4
``` rust
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
```
string主题的练习中，&str和string类型的互相转换是一个重点，但是需要额外注意的不仅是各类函数的适用对象，还有其返回值所有权的不同，如`to_lowercase()`方法返回的是一个全新的string类型变量，而不是发生了所有权的转移。

### 51 errors2
```rust
pub fn total_cost(item_quantity: &str) -> Result<i32, ParseIntError> {
    let processing_fee = 1;
    let cost_per_item = 5;
    let qty = item_quantity.parse::<i32>()?;
    
    Ok(qty * cost_per_item + processing_fee)
}
```
在这里解析item_quantity时，如果使用unwrap方法，解析错误会导致程序崩溃，而使用？运算符简化之后，如果发生解析错误，? 运算符会自动将 Err 值返回给调用方，从而避免了使用 unwrap 方法导致的潜在崩溃。

### 72 iterators2
rust的迭代器非常强大，也具有非常多的特性，这里进行整理：
1. 创建迭代器：你可以通过调用集合的 .iter()、.iter_mut() 或 .into_iter() 方法来创建迭代器，具体取决于你需要对集合进行何种操作（只读、可变或所有权转移）。
```rust
let numbers = vec![1, 2, 3, 4, 5];
let iter = numbers.iter();         // 创建只读迭代器
let iter_mut = numbers.iter_mut(); // 创建可变迭代器
let into_iter = numbers.into_iter();// 创建所有权转移迭代器
```
2. 迭代元素：使用 for 循环来遍历迭代器中的元素。在每次迭代中，迭代器会返回一个元素，并将其绑定到指定的变量上。
```rust
let numbers = vec![1, 2, 3, 4, 5];
for num in numbers.iter() {
    println!("Number: {}", num);
}
```
3. 使用迭代器逐个处理元素：你可以使用迭代器的方法链来对元素进行各种操作。例如，你可以使用 .map() 方法对每个元素进行映射，使用 .filter() 方法进行过滤，使用 .fold() 方法进行累积等等。

```rust
let numbers = vec![1, 2, 3, 4, 5];
let doubled_numbers: Vec<i32> = numbers.iter()
                                     .map(|&num| num * 2)
                                     .collect();
println!("{:?}", doubled_numbers);  // 输出: [2, 4, 6, 8, 10]
```
4. 惰性求值与及早求值：Rust 的迭代器是惰性求值的，意味着它们只在需要时才会产生元素。这使得你可以在迭代器链中组合多个操作，而不会立即执行它们。只有在需要结果时（例如调用 .collect() 方法）才会触发迭代器链的执行。
```rust
let numbers = vec![1, 2, 3, 4, 5];
let sum: i32 = numbers.iter()
                      .filter(|&num| num % 2 == 0)
                      .map(|&num| num * 2)
                      .sum();
println!("Sum: {}", sum);  // 输出: 12
```

### 104 algorithm4
```rust
fn insert(&mut self, value: T) {
    if self.root.is_none() {
        self.root = Some(Box::new(TreeNode::new(value)));
        return;
    }
    let mut root = self.root.as_mut().unwrap();
    loop {
        if value > root.value {
            if root.right.is_none() {
                root.right = Some(Box::new(TreeNode::new(value)));
                break;
            } else {
                root = root.right.as_mut().unwrap();
            }
        } else if value < root.value {
            if root.left.is_none() {
                root.left = Some(Box::new(TreeNode::new(value)));
                break;
            } else {
                root = root.left.as_mut().unwrap();
            }
        }
        else { break; }
    }
}
```
在算法题中涉及了好几次获取可变引用和unwrap，这里要注意的点是unwrap会导致所有权的转移，所以需要首先调用as_mut获取可变引用，再进行unwrap，防止出现所有权问题。

