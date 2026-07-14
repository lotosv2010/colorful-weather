const getCurrentWeather = require('./apis/getCurrentWeather');
const getWeatherForecast = require('./apis/getWeatherForecast');
const getHourlyForecast = require('./apis/getHourlyForecast');
const getMinutelyRain = require('./apis/getMinutelyRain');
const getLifeAdvice = require('./apis/getLifeAdvice');
const getAirQuality = require('./apis/getAirQuality');
const getWeatherWarnings = require('./apis/getWeatherWarnings');
const getAstronomy = require('./apis/getAstronomy');
const get30DayForecast = require('./apis/get30DayForecast');
const getHistoricalWeather = require('./apis/getHistoricalWeather');

const skill = wx.modelContext.createSkill('skills/weatherSkill');

skill.registerAPI('getCurrentWeather', getCurrentWeather);
skill.registerAPI('getWeatherForecast', getWeatherForecast);
skill.registerAPI('getHourlyForecast', getHourlyForecast);
skill.registerAPI('getMinutelyRain', getMinutelyRain);
skill.registerAPI('getLifeAdvice', getLifeAdvice);
skill.registerAPI('getAirQuality', getAirQuality);
skill.registerAPI('getWeatherWarnings', getWeatherWarnings);
skill.registerAPI('getAstronomy', getAstronomy);
skill.registerAPI('get30DayForecast', get30DayForecast);
skill.registerAPI('getHistoricalWeather', getHistoricalWeather);
