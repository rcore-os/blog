---
title: 2023-autumn-hwy-第三阶段总结
date: 2023-12-1 10:49:00
categories:
	- oscamp 2023fall arceos unikernel
tags:
	- author:uran0sH
---
# 总结报告
## 第一周练习
练习1是输出彩色字体，实现并不难。

练习2是移植hashmap，我将标准库里的 hashmap 拷贝过来，先全部注释掉，再根据测试结果逐步的去解除注释

练习三和四是实现内存分配算法和解析 fdt，解析 fdt 使用了群友推荐的库。

练习5是抢占式的 fifo，只需要将 rr 里面的抢占的代码移植过来

## 第二周练习
### 练习1 && 2
镜像格式：

|app_num|app_size|app_data|app_size|app_data|...|

一开始使用dd写入的时候一直无法读取第二个app，后来通过 hexdump 去解析镜像文件发现了问题在哪，进行了相应的修改。
### 练习 3
需要去掉 noreturn，让函数返回
### 练习 4
练习3使用 axstd 里面提供的 exit 方法就可以完成这个实验
### 练习 5
练习4需要注意寄存器 a7 被 rust 修改，每次调用完后需要重新设置 a7 的值，或者第一次返回的时候就保存好入口地址，以后就使用这个入口地址，还需要加上`clobber_abi("C")`。遍历字符串的时候使用 bytes 来迭代。
### 练习 6
需要先读取 app_num 和 app_size。其他就移植练习5过来就行。

代码仓库：https://github.com/uran0sH/arceos