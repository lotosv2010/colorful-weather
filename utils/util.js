function formatDate(theDate) {
  var _hour = theDate.getHours();
  var _minute = theDate.getMinutes();
  var _second = theDate.getSeconds();
  var _year = theDate.getFullYear()
  var _month = theDate.getMonth();
  var _date = theDate.getDate();
  if (_hour < 10) { _hour ="0" + _hour }
  if (_minute < 10) { _minute = "0" + _minute }
  if (_second < 10) { _second = "0" + _second }
  _month = _month + 1
  if (_month < 10) { _month = "0" + _month; }
  if (_date < 10) { _date ="0" + _date }
  var time= _year + "-" + _month + "-" + _date + " " + _hour + ":" + _minute + ":" + 
  _second;
 // var time = new Date();
 // var formatTime = formatDateTime(time);
 // 返回结果：
 // Tue Jun 06 2017 15:31:09 GMT+ 0800(中国标准时间)
 // 2017 - 06 - 06 15:31:09
 //clock为在data中定义的空变量，存放转化好的日期
  return time;
 }

 module.exports = {
  formatDate
}