---
title: ArceOS第八节课笔记
date: 2024-12-21 18:19:26
categories:
    - note
tags:
    - author:Winddevil
---

# 内容

![](00%20inbox/asset/Pasted%20image%2020241206004959.png)

虚拟机运行的实验内核是第一周的u_3_0：从pflash设备读出数据，验证开头部分。

有两种处理方式：
1. 模拟模式 - 为虚拟机模拟一个pflash，以file1为后备文件。当Guest读该设备时，提供file1文件的内容。
2. 透传模式 - 直接把宿主物理机(即qemu)的pflash透传给虚拟机。

优劣势：模拟模式可为不同虚拟机提供不同的pflash内容，但效率低；透传模式效率高，但是捆绑了设备。


# 实验



# 课后作业

