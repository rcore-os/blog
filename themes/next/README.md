<div align="right">
  Language:
  🇺🇸
  <a title="Chinese" href="docs/zh-CN/README.md">🇨🇳</a>
  <a title="Russian" href="docs/ru/README.md">🇷🇺</a>
</div>

![NexT preview](https://user-images.githubusercontent.com/16272760/83972923-98baae80-a915-11ea-8142-3cf875dad8bf.png)

<a title="NexT website" href="https://theme-next.js.org"><img align="right" alt="NexT logo" width="100" height="100" src="https://raw.githubusercontent.com/next-theme/hexo-theme-next/master/source/images/logo.svg"></a>

# NexT

> «NexT» is a high quality elegant [Hexo](https://hexo.io) theme. It is crafted from scratch with love.

[![NPM version](https://img.shields.io/npm/v/hexo-theme-next?color=red&logo=npm&style=flat-square)](https://www.npmjs.com/package/hexo-theme-next)
[![Required Node version](https://img.shields.io/node/v/hexo-theme-next?color=green&logo=node.js&style=flat-square)](https://nodejs.org)
[![Required Hexo version](https://img.shields.io/badge/hexo-%3E=4.0.0-blue?style=flat-square&logo=hexo)](https://hexo.io)
[![License](https://img.shields.io/badge/license-%20AGPL-orange?style=flat-square&logo=gnu)](https://github.com/next-theme/hexo-theme-next/blob/master/LICENSE.md)
[![Code Quality](https://img.shields.io/lgtm/grade/javascript/github/next-theme/hexo-theme-next?label=code%20quality&logo=lgtm&style=flat-square)](https://lgtm.com/projects/g/next-theme/hexo-theme-next/)
[![Build Status](https://img.shields.io/github/workflow/status/next-theme/hexo-theme-next/Linter?label=test&logo=github&style=flat-square)](https://github.com/next-theme/hexo-theme-next/actions?query=workflow%3ALinter)
[![Build Status](https://img.shields.io/github/workflow/status/next-theme/hexo-theme-next/Tester?logo=github&style=flat-square)](https://github.com/next-theme/hexo-theme-next/actions?query=workflow%3ATester)

## Live Preview

<p align="center">
  💟 <a href="https://theme-next.js.org/muse/">Muse</a> | 🔯 <a href="https://theme-next.js.org/mist/">Mist</a> | ♓️ <a href="https://theme-next.js.org/pisces/">Pisces</a> | ♊️ <a href="https://theme-next.js.org">Gemini</a>
<br>
<br>
  More «NexT» examples <a href="https://github.com/next-theme/awesome-next#live-preview">here</a>.
</p>

## Installation

The simplest way to install is to clone the entire repository:

```sh
$ cd hexo
$ git clone https://github.com/next-theme/hexo-theme-next themes/next
```

Or you can see [detailed installation instructions][docs-installation-url] if you want any other variant.

## Plugins

Plugins extend and expand the functionality of NexT. There are two types of plugins: core plugins and third-party plugins. The core plugins are required by the basic functions of NexT. Third-party plugins are loaded from jsDelivr CDN by default, and they provide a large number of optional features.

Configuring these plugins is very easy. For example, if you want to enable `pjax` on your site, just set `pjax` to `true` in NexT config file:

```yml
# Easily enable fast Ajax navigation on your website.
# For more information: https://github.com/next-theme/pjax
pjax: true
```

### Configure CDN

If you want to specify the CDN provider for any plugins, you need to set / update the CDN URL.

For example, if you want to set the CDN URL for `mediumzoom`, go to NexT config and see:

```yml
vendors:
  # ...
  # Some contents...
  # ...
  mediumzoom: # Set or update mediumzoom CDN URL.
```

## Update

NexT releases new versions every month. You can update to latest master branch by the following command:

```sh
$ cd themes/next
$ git pull
```

And if you see any error message during update (something like **«Commit your changes or stash them before you can merge»**), recommended to learn [Alternate Theme Config][docs-data-files-url] feature.\
However, you can bypass update errors by using the `Commit`, `Stash` or `Reset` commands for local changes. See [here](https://stackoverflow.com/a/15745424/5861495) how to do it.

**If you want to update from v5.x / v7.x to the latest version, read [this][docs-update-5-1-x-url].**

## Feedback

* Visit the [Awesome NexT][awesome-next-url] list to share plugins and tutorials with other users.
* Join our [Gitter][gitter-url] chats.
* [Add or improve translation][i18n-url] in few seconds.
* Report a bug in [GitHub Issues][issues-bug-url].
* Request a new feature on [GitHub][issues-feat-url].
* Vote for [popular feature requests][feat-req-vote-url].

## Contributing

We welcome you to join the development of NexT. Please see [contributing document][contributing-document-url]. 🤗

Also, we welcome Issue or PR to our [official-plugins][official-plugins-url].

## Contributors

- [iissnan/hexo-theme-next](https://github.com/iissnan/hexo-theme-next/graphs/contributors)
- [theme-next/hexo-theme-next](https://github.com/theme-next/hexo-theme-next/graphs/contributors)
- [next-theme/hexo-theme-next](https://github.com/next-theme/hexo-theme-next/graphs/contributors)

## Thanks

«NexT» send special thanks to these great services that sponsor our core infrastructure:

<a href="https://github.com"><img height="40" src="https://github.githubassets.com/images/modules/logos_page/GitHub-Logo.png"></a>

> GitHub allows us to host the Git repository and run the test suite.

<a href="https://www.netlify.com"><img height="40" src="https://www.netlify.com/img/press/logos/full-logo-light.svg"></a>

> Netlify allows us to distribute the documentation.

<a href="https://crowdin.com"><img height="40" src="https://support.crowdin.com/assets/logos/crowdin-logo-small-black.svg"></a>

> Crowdin allows us to translate conveniently the documentation.

<a href="https://www.jsdelivr.com"><img height="40" src="https://raw.githubusercontent.com/jsdelivr/jsdelivr-media/master/default/svg/jsdelivr-logo-horizontal.svg"></a>

> Thanks jsDelivr for providing public CDN service.

[docs-installation-url]: https://theme-next.js.org/docs/getting-started/installation.html
[docs-data-files-url]: https://theme-next.js.org/docs/getting-started/configuration.html
[docs-update-5-1-x-url]: https://theme-next.js.org/docs/getting-started/update-from-v5.html

[gitter-url]: https://gitter.im/hexo-next
[i18n-url]: https://crowdin.com/project/hexo-theme-next

[awesome-next-url]: https://github.com/next-theme/awesome-next
[issues-bug-url]: https://github.com/next-theme/hexo-theme-next/issues/new?assignees=&labels=Bug&template=bug-report.md
[issues-feat-url]: https://github.com/next-theme/hexo-theme-next/issues/new?assignees=&labels=Feature+Request&template=feature-request.md
[feat-req-vote-url]: https://github.com/next-theme/hexo-theme-next/issues?q=is%3Aopen+is%3Aissue+label%3A%22Feature+Request%22

[contributing-document-url]: https://github.com/next-theme/hexo-theme-next/blob/master/.github/CONTRIBUTING.md
[official-plugins-url]: https://github.com/next-theme
