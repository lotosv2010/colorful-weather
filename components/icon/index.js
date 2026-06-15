Component({
  properties: {
    src: String,
    colors: Array
  },
  observers: {
    'src, colors': function(src, colors) {
      // 读取 src 链接资源
      wx.getFileSystemManager().readFile({
        filePath: src,
        encoding: 'binary',
        success: res => {
          let basestr
          if (colors && colors.length) {
            const target = colors[0]
            const reColor = /#[a-zA-Z0-9]{3,6}|currentColor/g
            if (reColor.test(res.data)) {
              // 路径自带 currentColor / hex，逐个替换
              let a = 0
              basestr = res.data.replace(reColor, (word) => {
                const newColor = colors[a]
                a = a + 1
                return newColor ? newColor : word
              })
            } else {
              // 路径无 fill 属性，注入到 <svg> 根标签
              basestr = res.data.replace(/<svg\b([^>]*)>/, (m, attrs) => {
                const cleaned = attrs.replace(/\sfill="[^"]*"/g, '')
                return `<svg${cleaned} fill="${target}">`
              })
            }
          } else {
            basestr = res.data
          }
          // 将 svg 数据进行 URL 编码
          basestr = encodeURIComponent(basestr)
          this.setData({
            svgStyle: `background-image: url("data:image/svg+xml,${basestr}");`
          })
        },
        fail(err) {
          console.log(err)
        }
      })
    }
  }
})