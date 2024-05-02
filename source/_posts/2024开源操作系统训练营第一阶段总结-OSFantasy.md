---
title: 2024开源操作系统训练营第一阶段总结-OSFantasy
date: 2024-04-25 12:16:19
tags:
  - author:OSFantasy
  - repo:https://github.com/LearningOS/rust-rustlings-2024-spring-OSFantasy
---
# 第一阶段 - Rust学习
## 0 前言
Rust作为rCore操作系统的开发语言，学习并掌握它对于后面学习rCore OS是非常重要的（关于我Rust学了个大概就去硬啃rCore差点自闭这件事）。

这次训练营也是我二刷了，上次23秋季由于被学校抓去打互联网+等比赛了，🤦‍♂️实在是没有时间弄了，进了二阶段就没然后了。

![翻车gif](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/%E7%BF%BB%E8%BD%A6.gif)

一阶段时间过的好快，感觉还没学多少就过去了（时间都用去debug操作系统大赛的fatfs了🤦‍♂️）。所以总结的内容就比较普普通通了，各位大佬见谅🙏。
## 1 环境与工具软件等
由于本人并不是CS相关专业，过去主攻的是EE，所以CS里面的很多东西过去都没接触过。从23年秋季第一次接触训练营开始到现在，接触到了很多过去没有用过的工具软件以及一些开发环境，在此简单的列举了一些。
### 1.1 git和github
是的，你没有看错。我之前真没怎么用过git和github。一方面原因是，上大学后搞的都是嵌入式裸机的开发，远古单片机IDE（Keil）不支持高级的代码版本管理，加上我的学习路线上也没碰到过使用代码版本管理，索性代码直接放本地（别人要的话就u盘拷贝🤦‍♂️），就很少用git去把代码放仓库（之前实习时迫不得已去折腾了下）。另一方面是，git和github有些时候真的太卡了（之前不会挂代理也不敢挂梯子）。

![keil](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/32505a01374ea248b005d24e057e69da.png)

不过，现在熟悉了git的各个命令后，配合上github去做项目的代码版本管理是真爽呀。

![胡桃摇](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/QQ%E5%9B%BE%E7%89%8720240425173300.gif)

个人过去常用的git命令和个人理解如下：
```
git clone 			// 将repo(仓库)克隆到本地
git pull			// 合并远程repo的更新到本地
git add .			// 将更改的文件放入暂存区
git commit -m "<message>" 	// 创建一个新的提交，-m 后便是提交的消息
git push		 	// 将提交推到远程仓库
git branch			// 查看现有的分支
git branch <new_branch>		// 创键新的分支
git checkout <branch>		// 切换到某分支
git status			// 查看本地仓库状态
```
还有一些比如本地新建的分支需要推到远程、放弃某文件的修改等命令，就没去记了。我是做相关操作的时候，看一下报错建议的命令或在搜一下、问一下gpt，然后改一下。

另外初次使用可能需要配置用户信息：
```
git config --global user.name "Your Name"
git config --global user.email your.email@example.com
```
### 1.2 Linux操作系统（Ubuntu、CentOS）
虽说之前玩jeston和个人博客的时候也用过，但是基本上就是靠readme+baidu+CtrlCV+GPT（而且用了就忘），这次也算是又学习并加深了了解吧。这里就简单的列一下这期间用到的还记得的命令吧（大佬们清点喷555）

![派蒙抱大腿](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/4f0a8fc3601565ed6fab6b7ce506f375.gif)
```
ls                      	# 列出当前目录下的文件和文件夹
cd [目录名]			# 改变当前目录
sudo [命令]			# 以超级用户身份执行命令
sudo apt install [包名]		# 以超级用户身份通过apt安装软件包
apt-get install [包名]		# 通过apt-get安装软件包
touch [文件名]			# 创建一个空文件或修改文件的时间戳
vim [文件名]			# 打开文件进行编辑
rm [文件名/目录名]		# 删除文件或目录
make				# 用于编译程序的命令
cp [源文件/目录] [目标文件/目录]	# 复制文件或目录
mv [源文件/目录] [目标文件/目录]	# 移动或重命名文件或目录
mkdir [目录名]			# 创建一个新的目录
rmdir [目录名]			# 删除一个空目录
pwd				# 显示当前工作目录的路径
cat [文件名]			# 查看文件内容
file [文件名]			# 查看文件信息
tar [选项] [文件名]		# 打包或解包文件
gzip [文件名]			# 压缩文件
gunzip [文件名]			# 解压缩文件
wget [URL]                      # 从网络上下载文件
curl [URL]                      # 传输数据的工具，支持多种协议
ssh [用户名]@[IP地址]		# 通过SSH协议远程登录到另一台计算机
scp [源文件/目录] [用户名]@[IP地址]:[目标路径] # 通过SSH远程拷贝文件
df -h				# 显示磁盘使用情况
du -h [文件名/目录名]		# 显示文件或目录的磁盘使用情况
free -m                         # 显示内存使用情况
top                             # 显示实时的系统进程信息
ps                              # 显示当前进程的快照
kill [进程号]			# 结束一个进程
logout                          # 注销当前会话
reboot                          # 重新启动计算机
shutdown -h now                 # 立即关机
fdisk		              	# 一个用于磁盘分区的程序，可以创建、删除、修改和重新组织分区表
losetup 			# 用于设置和控制Loop设备，它可以将一个文件模拟成块设备，常用于挂载文件系统镜像
```
### 1.3 RustRover
强烈推荐，我刚开始是用的VSCode+RA插件或Vim+YouCompleteMe。后来换成rr后，感觉开发真的舒服了好多。一是因为二阶段写OS，在ubuntu里我用的VSCode写一会就会崩，比较卡。用Vim的话，代码文件一多切来切去麻烦的很；二是因为他的各个界面和PyCharm、IDEA是一样的，上手很快；三是多了很多有用的功能，比如你use了某个外部creat，rr会自动帮你在cargo.toml中加上依赖。

RustRover下载地址：https://www.jetbrains.com/zh-cn/rust/

Linux环境安装步骤：
```
1. 下载
2. cd到下载的路径
3. 解压下载的安装包：
4. cd到解压的路径
5. cd bin
6. ./rustrover.sh
7. 勾选一些东西确认安装后，等待片刻，便会进入到欢迎界面
```
在欢迎界面左下角点击设置图标，再点击(Create Desktop Entry)将rustrover添加到桌面目录。之后便可以使用了。

![xiao](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/54e8072598ba9d75c642cbbefc71cc35.jpg)
## 2 Rust知识
### 2.1 Rust学习资料
1.[Rust 中文圣经](https://course.rs/about-book.html)

2.[Rust 程序设计语言](https://rustwiki.org/zh-CN/book/)

3.[Rust 中文文档汇总](https://rustwiki.org/docs/)

4.[Rust 官方文档中文翻译](https://rustwiki.org/zh-CN/)

5.[Rust 半小时学习](https://fasterthanli.me/articles/a-half-hour-to-learn-rust)
半小时看不完呀！

![派蒙吃惊](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/13a7d07756aae4d99f0acd1cb497b570.gif)
### 2.2 个人觉得Rust比较有意思的知识点
#### 2.2.1 所有权（Ownership）和生命周期（Lifetimes）:
   - Rust的所有权和生命周期机制，可以防止诸如空悬指针、缓冲区溢出等内存安全问题。
   - 在Rust中，每个值都有且只有一个所有者。
   - 而在C语言中，并没有所有权概念，内存管理完全由程序员负责，这就可能导致内存泄漏和野指针等问题。
   ```rust
   // Rust
   {
       let s1 = String::from("hello");
       let s2 = s1;
       // 此时 s1 已经失效，不能被使用
   }
   ```
   ```c
   // C
   char *s1 = "hello";
   char *s2 = s1; 
   // 此时 s1 和 s2 都指向相同的内存
   ```
#### 2.2.2 借用检查（Borrowing）:
   - Rust的数据借用可以允许多个读访问，但只要有一个可变借用，就不能有其他读或写访问。
   - C语言没有这样的机制，因此需要手动管理指针和数据的共享。
   ```rust
   // Rust
   {
       let mut s = String::from("hello");
       {
           let r1 = &mut s;
           // 在此作用域内，不能借用 s 的其他引用
       } // r1 超出作用域，s 可以被再次借用
   }
   ```
   ```c
   // C
   char s[] = "hello";
   char *p1 = s;
   char *p2 = s; // p1 和 p2 都指向相同的内存
   ```
#### 2.2.3 模式匹配（Pattern Matching）:
   - Rust提供了强大的模式匹配功能，可以用于枚举、结构体、元组和字面量等。
   - C语言没有内置的模式匹配功能，通常需要使用`switch`语句和多个`if-else`链来实现。
   ```rust
   // Rust
   enum Coin {
       Penny,
       Nickel,
       Dime,
       Quarter,
   }
   let coin = Coin::Penny;
   match coin {
       Coin::Penny => println!("Penny"),
       Coin::Nickel => println!("Nickel"),
       Coin::Dime => println!("Dime"),
       Coin::Quarter => println!("Quarter"),
   }
   ```
   ```c
   // C 
   switch (coin) {
       case PENNY:
           printf("Penny");
           break;
       case NICKEL:
           printf("Nickel");
           break;
       case DIME:
           printf("Dime");
           break;
       case QUARTER:
           printf("Quarter");
           break;
   }
   ```
#### 2.2.4 并发（Concurrency）:
   - Rust提供了安全并发的工具，如`std::thread`、`Arc`（原子引用计数）和`Mutex`（互斥锁）。
   - C语言标准库没有内置的并发工具，通常需要使用操作系统提供的线程库（如POSIX线程）和同步原语。
   ```rust
   // Rust
   use std::thread;
   let handle = thread::spawn(|| {
       // 在新线程中运行的代码
   });
   handle.join().unwrap();
   ```
   ```c
   // C 
   pthread_t thread;
   int status = pthread_create(&thread, NULL, &thread_function, NULL);
   if (status != 0) {
       // 错误处理
   }
   pthread_join(thread, NULL);
   ```
#### 2.2.5 错误处理（Error Handling）:
   - Rust使用`Result`和`Option`类型来处理可能的错误或空值，这鼓励开发人员进行显式的错误处理。
   - C语言通常使用整数错误码和返回值，这可能导致错误被忽略或错误处理。
   ```rust
   // Rust
   fn open_file(file_name: &str) -> Result<File, io::Error> {
       File::open(file_name)
   }
   ```
   ```c
   // C
   int open_file(const char *file_name) {
       FILE *file = fopen(file_name, "r");
       if (!file) {
           return -1; // 返回错误码
       }
       return 0; // 表示成功
   }
   ```
## 3 总结
说来惭愧，这次训练营第一阶段大部分时间花在折腾OS大赛上了。本来到rCore的ch7时都挺顺利的，结果尝试去运行OS大赛的FAT32镜像里的测例就碰壁了。先是easyfs和fat32不是一个东西，得把照着rCore写的OS的fs换成支持fat32的，瞎折腾了两周总算是能读取fat32里的文件了。然后又发现大赛OS的elf文件导入OS运行又有问题，瞎折腾也搞不出来了（基础不牢靠，不懂为啥会loadpage Fault），索性打算重新复习。

这次训练营又学到了很多新的知识，不过也能很清楚地感觉到掌握的不牢靠，后面还需不断加强巩固。同时我也知道了如果自己后面想往OS方向发展，还有很多需要去学习的。说实话，刚开始搞rCore的时候感觉还挺好的，而后到了ch4后，计组等知识的欠缺就很致命了，搞的差点放弃了（fat32那也是，不过好在搞出来了）。然后到了运行OS大赛的elf这就真搞不懂了，只能试着去好好复习下Rust、看看计组、CSAPP等后，再来看看了。

感激社区提供了这样一个学习平台，它为我打开了一扇探索操作系统奥秘的大门。希望后续的学习我还能够坚持下去吧！

![npn](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/800a36d0ca944c3b35410e3dfabdbae9.jpg)

## 4 图片记录
![1](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20240425175537.jpg)

照着rCore写的FeatOS移植FAT32文件系统成功

