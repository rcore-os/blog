---

title: rust体会
date: 2024-11-11
categories:
    - rust language
tags:
    - author:ekkure
    - repo:https://github.com/ekkure/blog
---
### Rust编程技巧与示例：宏、算法与类型转换

在Rust编程中，有许多细节和技巧可以帮助开发者更好地组织代码、优化算法性能，以及确保类型安全。本篇博客汇总了一些Rust编程的核心要点和实用代码示例，涵盖了宏的使用、排序算法、树和图的操作等内容。

---

### 1. 宏与#[macro_export]、#[macro_use]

Rust中的宏非常强大，用于生成重复代码和提升代码的灵活性。使用`#[macro_export]`可以导出宏，使其在其他模块或包中可用；而`#[macro_use]`则在现代Rust中被推荐通过`use`语句显式引入。

示例宏定义：
```rust
#[rustfmt::skip]
macro_rules! my_macro {
    () => { println!("Check out my macro!"); };
    ($val:expr) => { println!("Look at this other macro: {}", $val); };
}
```

这里的`#[rustfmt::skip]`用于避免自动格式化，保持代码样式的灵活性和可读性。

---

### 2. Rust中的类型与特性

在实现数据结构或算法时，我们通常需要对泛型类型T施加一些特性约束，例如：
- `Ord`：使得元素可以比较大小，适用于排序、合并等操作。
- `Clone`：便于复制元素值，即使是复杂类型，也可以无所有权转移地复制。
- `Display`：实现字符串友好的格式化输出，便于打印和日志记录。

这些特性可以通过`where`语句在泛型实现中指定：
```rust
impl<T> LinkedList<T> 
where T: Ord + Clone + Display
```

---

### 3. 内存操作与指针

Rust通过`unsafe`块支持手动管理内存和指针操作，用于高性能或底层操作。
例如，获取节点的指针并解引用：
```rust
let node_ptr = Some(unsafe { NonNull::new_unchecked(Box::into_raw(node)) });
res.add((*node_ptr.as_ptr()).val.clone());
cur_a = (*node_ptr.as_ptr()).next;  // 注意这里直接获取的是ta的next指针
```

指针的安全解包和操作要格外小心，可以使用`Option`配合`unsafe`避免空指针风险。

---

### 4. 算法设计示例

#### 4.1 链表与树的操作

##### 插入与查找
在链表或树结构中，我们经常用到`Option`类型来表示节点的存在与否。例如，在插入和查找二叉树中，可以选择使用`if let`语句来处理`Some`和`None`的情况：
```rust
fn insert(&mut self, value: T) {
    if let Some(ref mut node) = self.root {
        node.insert(value);
    } else {
        self.root = Some(Box::new(TreeNode::new(value)));
    }
}
```
这种写法在处理可变引用时尤其简洁。

#### 4.2 排序算法与Ord与PartialOrd

选择排序等算法需要比较泛型元素的大小，通常需要`PartialOrd`特性来支持部分排序（如非全序关系的情况），而对于要求全序的场景可以使用`Ord`。

#### 4.3 深度优先与广度优先搜索

在图算法中，深度优先搜索（DFS）和广度优先搜索（BFS）是两种基础的遍历方式：
- DFS示例：
  ```rust
  fn dfs_util(&self, v: usize, visited: &mut HashSet<usize>, visit_order: &mut Vec<usize>) {
      visited.insert(v);
      visit_order.push(v);
      for &nei in self.adj[v].iter() {
          if !visited.contains(&nei) {
              self.dfs_util(nei, visited, visit_order);
          }
      }
  }
  ```

- BFS示例：
  ```rust
  fn bfs_with_return(&self, start: usize) -> Vec<usize> {
      let mut visit_order = vec![];
      let mut visited = vec![false; self.adj.len()];
      let mut queue = VecDeque::new();
      queue.push_back(start);
      visited[start] = true;

      while let Some(node) = queue.pop_front() {
          visit_order.push(node);
          for &neighbor in &self.adj[node] {
              if !visited[neighbor] {
                  visited[neighbor] = true;
                  queue.push_back(neighbor);
              }
          }
      }
      visit_order
  }
  ```

#### 4.4 平衡堆的插入与调整

Rust标准库中`Vec`的`swap_remove`方法可以高效地删除指定位置的元素，适用于实现优先队列等堆结构：
```rust
let result = self.items.swap_remove(1);  // 移除并返回指定位置的元素
```

在删除元素后，可以通过调整堆结构（如最小/最大堆）来保持堆的性质。

---

### 5. 实现栈与队列

使用双队列实现栈的操作逻辑：
```rust
pub struct myStack<T> {
    q1: Queue<T>,
    q2: Queue<T>
}

impl<T> myStack<T> {
    pub fn push(&mut self, elem: T) {
        self.q2.enqueue(elem);
        while !self.q1.is_empty() {
            self.q2.enqueue(self.q1.dequeue().unwrap());
        }
        std::mem::swap(&mut self.q1, &mut self.q2);
    }
}
```

这种方法利用队列的FIFO特性来模拟栈的LIFO特性。

---

### 6. 函数与内存管理

Rust中的`Box`和`unsafe`结合用于手动管理堆内存。`Box::from_raw`可以从裸指针重新创建`Box`，这在需要手动内存管理的场景中非常有用。
```rust
unsafe fn raw_pointer_to_box(ptr: *mut Foo) -> Box<Foo> {
    let mut ret: Box<Foo> = unsafe { Box::from_raw(ptr) };
    ret.b = Some(String::from("hello"));
    ret
}
```

这种方法常用于FFI（外部函数接口）中将指针恢复为拥有所有权的Rust类型。

---

### 总结

Rust语言通过丰富的内存管理工具和类型系统，确保了在安全性和性能上的平衡。无论是自定义数据结构还是排序、图遍历等基础算法，Rust的特性可以为代码提供极大的灵活性和安全保障。