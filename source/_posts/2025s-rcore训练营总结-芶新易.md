---
title: 2025s-rcore训练营总结
date: 2025-05-23 11:43:25
tags:
    - author:plerks
    - repos: 
        - https://github.com/LearningOS/2025s-rustling-plerks
        - https://github.com/LearningOS/2025s-rcore-plerks
        - https://github.com/LearningOS/2025s-arceos-plerks
        - https://github.com/plerks/rcore-notes
        - https://github.com/plerks/arceos-notes
---

这是rcore训练营前三个阶段的总结报告。

做实验的过程中有写一些笔记，不过是写给自己看的，行文有些杂乱：[rcore-notes](https://github.com/plerks/rcore-notes)，[arceos-notes](https://github.com/plerks/arceos-notes)。

---

在群里看到有人分享rcore训练营的消息，然后在rcore开营启动会那天加入了进来。对os的很多概念一直只能靠想象，没有代码级的理解，通过这次训练营，学到了非常非常多。以前尝试去看过[《一个64位操作系统的设计与实现》](https://www.ituring.com.cn/book/2450)这本书，但是这本书并无过多讲解，并不适合入门os代码，读不动。现在有了训练营的基础，后面有时间再试试。

训练营的内容大部分时间是读代码，完成练习所需写的代码量并不大。训练营准备了详尽的文档与指导书，并已经准备好了构建脚本，能非常顺利地上手开始学习os。

此外，这次训练营学习还连带着学习了rust，之前听说过rust和其它语言在思维上有些不同，不过实际接触下来感觉还好，还是和c++很相似的，只是有个所有权的机制很特别。rust吸收并处理了c++的一些好的概念与不足(移动语义，没有包管理器等等)，有Cargo这一点比c++方便多了。

# 第一阶段
学习rust基础，做rustlings的练习。

这个比较基础，我是看了下rust的[菜鸟教程](https://www.runoob.com/rust/rust-tutorial.html)学rust，然后做的过程中不知道的问chatgpt就行。

# 第二阶段
学习rcore指导书并完成5个实验。

rcore指导书的质量非常高，前几章基础的代码需要仔细阅读理解，这样就能知道基础的执行流程。

前面的章节把一些代码(比如那几个汇编写的函数)交给chatgpt解读非常方便。后面的章节效果要差一些，有些主要起个提示作用。

# 第三阶段
学习arceos并完成6个练习。

原本以为第三阶段是第二阶段的递进，会去学习M态的rustabi什么的，但是实际第三阶段的arceos是和rcore指导书平级的，相当于是另一种设计思路下实现的os。

有了第二阶段rcore指导书的基础，第三阶段问题不大。

# 总结
训练营的质量非常高，特别是考虑到了对学生的教学，文档和工程都很齐全，rcore指导书的质量非常高。学习到了很多。

感谢清华大学的老师们开放的课程，以及助教，群友等的答疑。