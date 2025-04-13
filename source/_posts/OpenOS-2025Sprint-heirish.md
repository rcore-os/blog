---
title: OpenOS-2025Sprint-heirish
date: 2025-04-13 23:01:16
tags:
    - author:heirish
    - repo:https://github.com/LearningOS/2025s-rcore-heirish
---
### 2025.04.13
- 准备第二阶段实验环境
  - 课程页面点击链接领取作业，创建仓库:https://github.com/LearningOS/2025s-rcore-heirish
  - clone到本地并配置docker环境

  ```
  ##参考:1.作业仓库README, 2.https://learningos.cn/rCore-Tutorial-Guide-2025S/0setup-devel-env.html
  git@github.com:LearningOS/2025s-rcore-heirish.git
  cd 2025s-rcore-heirish
  su root
  make docker
  ```
- 准备博客
  ```
  #fork from https://github.com/rcore-os/blog 
  git@github.com:heirish/blog.git
  cd blog
  sudo npm install hexo-cli -g 
  sudo npm install hexo --save
  hexo n OpenOs-2025Spring-heirish
  ```
  - 注意：虚拟机中不能存放到与host windows共享的目录下，要放到虚似机系统本身的目录。因为与host windows共享的目录是不能创建软链接的， 否则安装hexo时会报错