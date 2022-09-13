---
title: 2022暑期rcore学习总结-traversalnat
date: 2022-08-01 11:08:46
categories:
    - report
tags:
    - author:traversalnat
    - summerofcode2022
    - rcore-lab
---

### rust
深入理解引用和所有权有助于减少与rust编译器的斗争。

<!-- more -->

**引用在rust中是一个类型**，引用的底层实现是指针，正如指针在 C/C++ 中是一个独立类型，在使用引用时也需要将之作为一个类型看待，需要与 C++ 中的引用区分开来。使用引用作为参数的函数只能接受引用，传入一个非引用类型会导致编译器报错，理解了这里可以减少大部分与编译器斗争的时间。

1. `vec.iter().map(|x| {})` 中 x 类型是一个引用，`vec.iter().map(|&x| {})` 此时 x 类型便是解引用后的类型，在匿名函数中解引用，需要对应的类型支持 Copy Trait，否则会导致所有权问题。
2. `vec.iter().max()`得到的数据也是一个引用，总之在对容器内数据进行链式处理时，为了所有权不丢失，使用的都是引用。
3. 不能通过引用获取原数据的所有权，`let data2 = *(&data)` 会导致报错（data类型不支持 Copy Trait的情况下）。
4. `for &v in &vec` 与匿名函数中 &x 一样，x 的类型是解引用后的类型，会导致所有权和 Copy Trait 的问题。

### 内存

​	关于页表如何使虚拟地址转换为物理地址，https://github.com/mit-pdos/xv6-riscv-book/blob/xv6-riscv/fig/riscv_pagetable.svg 给出了一个比较直观的转换过程。

​	内核通过 PageTable 结构体维护页表，PageTable 需要记录一级页表目录的地址，通过 map/unmap 两个函数来映射虚拟内存页至物理内存页，需要映射内存页时，虚拟页号低27位可平均分为三部分 L2,L1,L0, 物理页号 ptr由物理页帧管理器申请得到：

	1. 通过 L2 在一级页表目录中找到 PTE，
		1. 若PTE 无效，则需要申请一个新的物理页作为二级页表目录，并修改 PTE 中 PPN 记录二级页表目录的物理页号
		2. 使用 PTE 中 PPN （物理页号）找到二级页表目录 物理地址(PPN << 12 即可得到二级目录物理地址)
	2. 使用 L1 在二级目录中找到 PTE
		1. 若PTE 无效，则需要申请一个新的物理页作为三级页表目录，并修改 PTE 中 PPN 记录三级页表目录的物理页号
		2. 使用 PTE 中 PPN （物理页号）找到三级页表目录物理地址
	3. 使用 L0 在三级目录中找到 PTE，修改 PTE 中的 PPN 为 ptr ，根据参数修改 Flags



### 文件

#### 索引

```rust
在磁盘上的索引节点区域，每个块上都保存着若干个索引节点 DiskInode
const INODE_DIRECT_COUNT: usize = 28;
// 控制 在 128 字节
#[repr(C)]
pub struct DiskInode {
    pub size: u32, // 文件/目录内容的字节数
    pub direct: [u32; INODE_DIRECT_COUNT], 
    pub indirect1: u32, 
    pub indirect2: u32,
    type_: DiskInodeType, // 表示索引节点的类型
}
```

可以将一个数据块（512字节）看做是一个 [block_id: u32; 128] 的数组，block_id 可以是下一级数据块或者下一个索引所在数据块。

| 索引      | 直接索引                             | 一级索引（一个数据块）          | 二级索引（一个数据块）          |
| --------- | ------------------------------------ | ------------------------------- | ------------------------------- |
| Direct    | [block_id:  u32; INODE_DIRECT_COUNT] |                                 |                                 |
| Indirect1 | Block_id:  u32                       | `[block_id:u32;  BLOCK_SZ / 4]` | ` `                             |
| Indirect2 | Block_id:  u32                       | `[block_id:u32;  BLOCK_SZ / 4]` | `[block_id:u32;  BLOCK_SZ / 4]` |

#### 磁盘布局

| 0     | 超级块       | SuperBlock  （记录下述每个区域使用的数据块数量）             |
| ----- | ------------ | ------------------------------------------------------------ |
| 1..   | 索引节点位图 | BitMap 用于分配、释放DiskInode                               |
|       | 索引节点区域 | [DiskInode] 数组，DiskInode 记录文件/目录字节数，与数据块节点（数据块节点可以作为一、二级索引块索引更多数据块）  （目录项记录DiskInode 的序号即 inode_number） |
|       | 数据块位图   | BitMap 用于分配、释放数据块                                  |
| ..end | 数据块区域   | [[u32; 128]] , 每个数据块为 [u32; 128]，共512 字节           |

使用索引节点区域中第一个 DiskInode 作为根目录的索引节点，该节点索引得到的文件记录根目录下的所有文件，这个文件可视为 [DirEntry] 数组，每一个DirEntry 记录着该目录项的文件名和 inode_number，inode_number 记录 DiskInode 在 索引节点区域 中的序号，要通过 inode_number 找到 DiskInode，需要得知索引节点区域的起始地址，并通过 inode_number 计算其所处的数据块地址和在数据块中的偏移。

| 索引节点pos | 索引节点   | 对应文件/目录 |
| ----------- | ---------- | ------------- |
| 0           | root inode | "/"           |

