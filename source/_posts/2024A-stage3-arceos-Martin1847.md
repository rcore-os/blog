---
title: 2024A-stage3-arceos-Martin1847
date: 2024-12-02 23:25:11
tags:
    - author:martin1847
    - repo:https://github.com/martin1847/oscamp
---

# Arceos 总结

核心学习了`arceos`作为组件化设计的理念，抽象微内核、宏内核和VVM之间的共同点。

基于这些比如调度`task`,内存空间`mmaddr`,文件系统`fs`的底层组件，可以方便的完成需求。


## lab1 内存分配挑战


通过`lab1`内存分配器的实现，对内存加深了理解，就是个大`byte[]`,物理地址就是index。

lab1核心实现就是借用操作系统的分配思想，内存空间分堆区和栈区，堆区存放不需要回收的数据（一直增长，没有内存碎片），栈区放需要回收的，包括vec中间扩容的。这部分处理掉可以达到`373`，参考实现：

https://github.com/martin1847/oscamp/blob/lab1/arceos/labs/lab_allocator/src/lib.rs


```python
# 每轮最小生存对象
>>> a = 262144 + 65536 + 16384 + 4096 + 1024 + 256 + 64 
# 每轮额外需要的临时空间
>>> tmp = sum([524288, 131072, 32768, 8192, 2048, 512, 128, 32])
699040
# [PA:0x8026f000, PA:0x88000000) free memory (READ | WRITE | FREE)
>>> total = 0x88000000 - 0x8026f000
131665920
>>> (total - tmp )/a
374.7221204907526
# 考虑每轮增加还有一部分额外内存，7 * sum[1..N]
>>> (total - tmp - 7 * sum(range(1,373)) )/a
373.33259132942686
```




<!-- more -->

## unikernel

这种模式内核就是应用，共享地址空间，系统调用变成了函数调用。（不过在现有硬件下一个上下文貌似在`几个us`的级别，相比IO的10毫秒级别，感觉可以忽略不计，又有些鸡肋）

虽然理论上可以达到应用最佳性能，是服务端`serverless`的理想方案。

不过考虑到裸机成本，需要引入虚拟化。这也让我对`Hypervisor`加大了兴趣。


## 宏内核

利用`arceos`的组件化能力，较少改动就可以支持。

这里做了一个`mmap`的实验。这里做了个小优化，内容小于一页的时候，直接读取到对应地址，减少一次`内存copy`。

```rust
if size_align > PAGE_SIZE_4K {
    let mut buf = alloc::vec![0; len];
    // for each page to write with offset.
    get_file_like(fd).and_then(|f| f.read(&mut buf));
    uspace.write(addr_at, &buf);
} else {
    let (paddr, _, _) = uspace.page_table().query(addr_at).unwrap();
    // 开启分页，内核也是要用虚拟地址
    let kernel_vaddr = phys_to_virt(paddr);
    // single page, write directly
    get_file_like(fd).and_then(|f| {
        f.read(unsafe { from_raw_parts_mut(kernel_vaddr.as_mut_ptr(), len) })
    });
}
```

## Hypervisor

据说现在的云厂商大部分都是基于`KVM`的硬件虚拟化方案，也即 `Type 1` 虚拟化。

对既能达到高性能、又能安全便捷的技术，非常感兴趣。原来硬件层面提供了一些支持、能力。

通过实验，对riscv架构下`GVA->GPA->HPA`页表转换支持、中断注入增加了了解。

对于`type 1.5`虚拟化页增加了兴趣，尤其看到`Jailhouse`这种还可以物理隔离，那么`rtos`和穿透分时os就可以共存了。

```txt
+-----------------------+-----------------+
|                       |                 |
|        Linux          |       RT        |
|                       |                 |
+-----------------------+-----------------+
|                   Jailhouse             |
+-----------------------+-----------------+
| CPU 0 | CPU 1 | CPU 2 |      CPU 3      |
+-------+-------+-------+-----------------+
| Root cell             |      Cell 0     |
+-----------------------+-----------------+
```


