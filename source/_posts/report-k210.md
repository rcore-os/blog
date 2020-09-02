---
title: 移植rCore-Tutorial 到k210 徐文浩报告
date: 2020-08-30 21:30:00
categories: 
    - report
tags:
    - author:freheit889
    - summerofcode2020
---

#  移植rCore-Tutorial 到k210 徐文浩报告

<!-- TOC -->

 移植rCore-Tutorial 到k210 徐文浩报告](#移植rCore-Tutorial 到k210 徐文浩报告)
  - [目录](#目录)
  - [实验目标描述](#实验目标描述)
  - [已有相关工作介绍](#已有相关工作介绍)
  - [主要成果描述](#主要成果描述)
      - [在opensbi上运行lab1-6](#在opensbi上运行了lab1-6)
      - [在rustsbi上运行lab1-6](#在rustsbi上运行了lab1-6)
      - [在sd卡上读写用户态](#在sd卡上读写用户态)
      - [虚拟存储](#虚拟存储)
      - [致谢](#致谢)
  - [实验总结](#实验总结)
  
 <!-- /TOC -->
<!-- more -->

## 实验目标描述
rCore-tutorial是用rust实现的操作系统，至今为止已经开发到第三版，更适应教学，在以往的rCore
中，已经实现了在k210板子上的运行，但是因为指令集的更新以及其他原因，所以我们现在需要将rCore-Tutorial在k210板子上跑起来

## 已有相关工作介绍
王润基学长在19年的时候成功的将rCore在k210上跑了起来，在我参与工作之前，吴一凡学长已经做了一些工作，让我可以很方便的跑起来，对之后的移植帮助很大

## 主要成果描述
### 在opensbi上运行了lab1-6
 
 在最初没有实现虚拟存储的时候，我是将用户镜像链接在了内核中，下载速度很慢，而且主要是将内存中的一块区域模拟成了块设备，虽然运行的时候速度很快，但是容量有限
 
 主要参考：https://github.com/rcore-os/rCore_tutorial 第二版的实现方式
 相应的commit:https://github.com/freheit889/rCore-Tutorial/commit/29908edb233b7ec48496e3ccf2760d7276086ebe
 
 ### 在rustsbi上运行了lab1-6
 
 在跟洛佳同学沟通过之后，我觉得现在的rustsbi已经足以支持我们将lab1-6移植到上面去了，于是我开始了移植，刚开始因为指令集规范不同，所以对页表有一些错误的操作
 以至于无法运行，在后期更改之后就可以正常运行了。但是如果想用SD卡的话，需要对底层的设备有一些访问，现在的rustsbi还不是很支持，所以只进行了lab1-6，以后等rustsbi更为
 完善的时候，我想之后的实验就没问题了
 
 rustsbi:https://github.com/luojia65/rustsbi
 相应的commit:https://github.com/freheit889/rCore-Tutorial/commit/850f2ac1eb0d587f37c2e3ab8b25028dc5c3a5bc
 
 ### 在sd卡上读写用户态
 
 刚开始我想直接用sd卡的例程，但是老是访问m态，所以我就想着是不是可以先用flash，在我搞flash的过程中，吴一凡学长告诉我他把sd卡搞定了。然后之后的sd卡块驱动之类的我
 把它搞定了，但是这个时候在内核重映射的时候没有把这一段物理地址映射过去，所以我手动添加了一些offset为0的映射，这样就可以正常使用了。
 
 相应的commit:https://github.com/freheit889/rCore-Tutorial/commit/e93ae81a7136ea784bf670f812928574798395fc
 
 ### 虚拟存储
 
 这里的虚拟存储主要参考了rCore-Tutorial里的置换算法,但是在使用过程中，会有爆栈的错误，后来想了一个折中的方法，就是将线程的运行栈大小调的很大，在使用的时候，如果缺页，就进行置换，
 也可以一定程度上解决问题，最后也算是实现了，不足之处只能等之后再搞了
 
 参考：https://rcore-os.github.io/rCore-Tutorial-deploy/docs/lab-3/guide/part-5.html
 相应的commit:https://github.com/freheit889/rCore-Tutorial/commit/8a43cdfc191b7fba3df9e634806adec8d5a65e19
 
 ### 致谢
 感谢向勇老师跟陈渝老师给的这次机会，还有王润基学长跟吴一凡学长给与的帮助，我在这次活动中收获了很多，也非常开心，希望之后还能参与进来做更多的事情，完结撒花😁
 
 ## 实验总结
 感觉自己算是真的是把之前不会的东西都学明白了，只靠理论好多东西都不知道为什么，在艰难的debug中学习到了很多知识，虽然过程很痛苦，但是调出来的那一瞬间非常开心！
 
