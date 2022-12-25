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
            let a = 0
            // 匹配 Hex 数值，并进行替换
            basestr = res.data.replace(/#[a-zA-Z0-9]{3,6}|currentColor/g, (word) => {
              const newColor = colors[a]
              a = a + 1
              return newColor ? newColor : word
            })
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