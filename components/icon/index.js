// SVG 文件内容缓存，避免相同路径重复读取
const svgCache = new Map();

const readSvg = (filePath, callback) => {
  if (svgCache.has(filePath)) {
    callback(svgCache.get(filePath));
    return;
  }
  wx.getFileSystemManager().readFile({
    filePath,
    encoding: 'binary',
    success: res => {
      svgCache.set(filePath, res.data);
      callback(res.data);
    },
    fail(err) {
      console.log(err);
    }
  });
};

Component({
  properties: {
    src: String,
    colors: Array
  },
  observers: {
    'src, colors': function(src, colors) {
      if (!src) return;
      readSvg(src, (raw) => {
        let basestr;
        if (colors && colors.length) {
          const target = colors[0];
          const reColor = /#[a-zA-Z0-9]{3,6}|currentColor/g;
          if (reColor.test(raw)) {
            let a = 0;
            basestr = raw.replace(reColor, (word) => {
              const newColor = colors[a];
              a = a + 1;
              return newColor ? newColor : word;
            });
          } else {
            basestr = raw.replace(/<svg\b([^>]*)>/, (m, attrs) => {
              const cleaned = attrs.replace(/\sfill="[^"]*"/g, '');
              return `<svg${cleaned} fill="${target}">`;
            });
          }
        } else {
          basestr = raw;
        }
        this.setData({
          svgStyle: `background-image: url("data:image/svg+xml,${encodeURIComponent(basestr)}");`
        });
      });
    }
  }
});
