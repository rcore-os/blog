# rcore-os Blog

## 发布博客的流程

1. 将本仓库 （git@github.com:rcore-os/blog.git）fork 之后，clone 到本地，并进入 `blog` 目录下；

2. 切换到root权限，安装 Hexo
   
   ```
   npm install hexo-cli -g 
   npm install hexo --save
   ```

3. 创建新博客: `hexo n "<blog-title>"`，其中 `<blog-title>` 为博客标题；

4. 此时在 `blog/source/_posts/` 目录下会看到 `<blog-title>.md` 以及一个名为 `<blog-title>` 的文件夹，我们需要将博客的内容放在 `<blog-title>.md` 中，并将这篇博客相关的图片放在 `<blog-title>` 文件夹中。注意，请不要修改其他文件；

5. 写完博客后，若该 blog/ 目录下存在`package-lock.json`文件，请手动删除，可用`rm -f package-lock.json`，之后再 `commit`;

6. 修改之后，通过 提 pr 的形式将博客推送到远程仓库，pr通过后，Github 会自动重新构建静态网页并部署到 Github Pages：[rcore-os Blog](https://rcore-os.cn/blog/)。
   
   ## 博客分类/标签信息
   
   打开 Hexo 为我们建好的 `<blog-title>.md`，我们会看到这样的开头：
```
   
---

title: <blog-title>
date: 2020-07-15 16:40:28
tags:

---

```
我们在其中加入分类/标签/作者信息：
```

---

title: <blog-title>
date: 2020-07-15 16:40:28
categories:
    - <catogory>
tags:
    - author:<your_github_id>
    - repo:<rcore-os-repo_you_worked_on>
    - <other_tag_0>
    - <other_tag_1>
    - ...

---

```

* 分类：目前没有对嵌套分类进行处理，希望大家最多只分一类，不要有多种类型；
* 标签：博客默认只有一个作者，所以目前想到用不同的标签对作者以及本篇博客相关工作所在的仓库进行区分。至于其他的标签可以自由发挥，但是当已经存在类似的标签时应该沿用已有的而不是新建另外一个。



> 注意：
>
> - 注意，"author:" 与你的 githubID之 间不要留有空格。
> - 文中出现的'<'和'>'只是为了标识变量，实际操作时候应该移除它们。



## 数学公式支持

只需在博客开头区打开 mathjax 开关即可：

```

mathjax: true

```

## 插入本地图片

目前这项功能还很简陋...之后再慢慢优化。

假设你要插入一张 `<image-file>`，那么首先你应该把它放在 `blog/source/_post/<blog-title>` 文件夹中，然后在需要插入图片的位置，用如下的 tag 来插入图片（注意：这里的'<'和'>'只是为了标识变量，插入图片的时候应该移除它们）：

```

{% asset_img <image-file> <image-title> %}

```

其功能等同于 `![<image-title>](<image-file>)`。

## 预览
博客根据标记`<!-- more -->`为Github Pages首页提供预览

可在博客中适当位置添加标记`<!-- more -->`，该标记以下的内容将不会在Github Pages的首页展示

特殊：紧跟开头加入标记(如下所示)，会在Github Pages的首页全片幅展示你的博客
```

---

title: <blog-title>
date: 2020-07-15 16:40:28
tags:

---

<!-- more -->

```

## Log
* 目前通过 [Github pages](https://rcore-os.github.io/blog/) 可以访问
* 尝试加入 CI/CD 在 pr/push 后自动部署
* 测试自动安装 node.js 是否成功
* 需要某些权限才能接着搞，比较有用的参考链接如下：
  * https://frostming.com/2020/04-26/github-actions-deploy
  * http://www.ruanyifeng.com/blog/2019/09/getting-started-with-github-actions.html
  * https://ming.theyan.gs/2019/10/hexo-github_action-github_pages/
* 目前已经实现在 pr/push 后自动更新博客，现在测试一下标签/分类功能以及图片功能是否正常，如果正常的话更新博客发布教程。
* 经过一番折腾这些功能都比较正常了...
