---
title: os-camp-arsnshsj
date: 2024-12-1 21:44:23
tags:
    - author:arsnshsj
---

## unikernel
#### 特点：
+ 内核组件化
+ 内核和应用处于同一内核级，共享同一个地址空间，既是应用又是内核

#### 课后练习：<print_with_color>
 
如果希望只有通过println宏打印出来的文字有颜色，就应该选择在println定义的地方进行修改，即在axstd中修改
在/arceos/ulib/axstd/src/macros.rs中找到println宏的定义，进行颜色的添加
以下是修改前的输出
![](https://fastly.jsdelivr.net/gh/RDWaaaaaa/img/06b5324165939b271ee5b159902eed8.png)
以下是修改后的输出
![](https://fastly.jsdelivr.net/gh/RDWaaaaaa/img/d56087b3ef2408c6861436ad42677ae.png)
如果希望包括启动信息在内的内容都以某个颜色打印，就需要修改更底层的位置，即修改axhal
找到了axhal中调用输入输出的地方，进行颜色的添加
修改后的输出
![](https://fastly.jsdelivr.net/gh/RDWaaaaaa/img/10c71f65522d3e8844b92d2a1353fe7.png)

#### 课后练习<支持HashMap类型>

`hashbrown` 是一个高性能的哈希集合和哈希映射库，提供了 Rust 标准库中 `HashMap` 和 `HashSet` 的实现。实际上，Rust 标准库的哈希集合和哈希映射类型（如 `std::collections::HashMap` 和 `std::collections::HashSet`）在底层就依赖于 `hashbrown`。

将hashbrown::HashMap引进就可以了
建立以下路径的文件
/arceos/ulib/axstd/src/collections/mod.rs
添加引用
```rust
pub use hashbrown::HashMap;
```
然后得到结果
![](https://fastly.jsdelivr.net/gh/RDWaaaaaa/img/31d0cd13814fb6841634ad55a7b7e9c.png)


#### 课后练习<为shell增加文件操作命令>

底层已经提供了rename有关的接口，直接调用就实现了rename
关于mv，可以分两种情况，mv的是文件还是文件夹：
如果是文件，其实mv的本质就是rename，将文件夹的路径修改到文件名的前面
如果是文件夹，我认为可以递归文件夹下的所有文件和文件夹，进行rename
![](https://fastly.jsdelivr.net/gh/RDWaaaaaa/img/719e19d90a49a2421b9a1e61e85c435.png)

![](https://fastly.jsdelivr.net/gh/RDWaaaaaa/img/c8df0a9bdb831b3194cc88c480c049e.png)
#### 课后练习<bump内存分配算法>

根据给的图示完善结构体，
```rust
pub struct EarlyAllocator <const PAGE_SIZE: usize>{
    start: usize,
    end: usize,
    b_pos: usize,
    p_pos: usize,
}
```
alloc时，先对现有的b_pos向上取整对齐，再加上新分配的长度
对于页分配，就多考虑一个页面大小
![](https://fastly.jsdelivr.net/gh/RDWaaaaaa/img/b5289e462a76b4e4ccf94846d619618.png)