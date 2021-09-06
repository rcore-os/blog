---
title: 2021操作系统夏令营总结-Rustsbi移植-yunfneg2
date: 2021-09-06 14:19:02
categories:
	- report
tags:
	- author:ez4yunfeng2
	- summerofcode2021
	- rustsbi
---

[repo地址](https://github.com/ez4yunfeng2/rustsbi-nezha)

### 最终成果

移植了rustsbi的基本功能，已经能够成功在哪吒开发板上引导zcore

<!-- more -->

### 选择移植Rustsbi的原因

1.为今后在哪吒开发板上的进一步开发打好基础

2.对rustsbi的的功能与实现有一个初步的了解



# 相关资料

| 资料                         | 链接                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| D1 官方资料                  | [点击](https://d1.docs.aw-ol.com/)                           |
| D1官方讨论社区               | [官方连接](https://bbs.aw-ol.com/recent?cid[]=6)             |
| D1 DataSheet                 | [点击](https://whycan.com/files/members/3907/D1_Datasheet_V0.1_Draft_Version.pdf) |
| D1 用户手册（英文）          | [点击](https://whycan.com/files/members/3907/D1_User_Manual_V0.1_Draft_Version.pdf) |
| D1开发调试记录（英文版图文） | [点击](https://ee-paper.com/rvboards-nezha-first-experience-post（-quanzhi-d1-risc-v-64bit/) |
| D1 启动流程分析              | [点击](https://www.rvmcu.com/column-topic-id-777.html)       |
| c906 DataSheet               | 点击                                                         |
| c906 用户手册                | [点击](https://alitech-private.oss-cn-beijing.aliyuncs.com/1620802891167/玄铁C906R2S1用户手册_v04.pdf?Expires=1628350363&OSSAccessKeyId=LTAI5tFKS6CSfKPbtNapFDc1&Signature=kTyo%2BbyQlpzXNF84LN5zFPC5e0c%3D) |
| SBI规范                      | [中文版](https://zh.wikisource.org/wiki/特权层二进制接口规范标准) [点击](http://neversettered.cn/) |
| zcore快速引导                | [点击](https://github.com/elliott10/zCore/blob/riscv64-c906/zCore/README-riscv64.md) |
| d1启动流程分析               | [点击](https://www.rvmcu.com/column-topic-id-777.html)       |
|                              |                                                              |



### 参考代码

1.coffee https://github.com/jwnhy/coffer

2.xboot https://github.com/xboot/xboot

3.opensbi https://github.com/elliott10/opensbi



### 实现细节

1.大致参照rustsbi-k210框架

2.利用xfel工具进行烧录

3.注意设置PMP

4.没什么其他的复杂问题.



### 总结

​	参加了这次夏令营之后，我收获颇丰。认识了很多志同道合的朋友，增长了见识。将整整有一个暑假利用了起来。



### 致谢

感谢助教萧络元及全志刘劭文同志对我们项目的支持	
