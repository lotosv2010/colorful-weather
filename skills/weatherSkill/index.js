const getCurrentWeather = require('./apis/getCurrentWeather');
const getWeatherForecast = require('./apis/getWeatherForecast');
const getLifeAdvice = require('./apis/getLifeAdvice');
const getAirQuality = require('./apis/getAirQuality');
const getWeatherWarnings = require('./apis/getWeatherWarnings');

const skill = wx.modelContext.createSkill('/skills/weatherSkill');

skill.registerAPI('getCurrentWeather', getCurrentWeather);
skill.registerAPI('getWeatherForecast', getWeatherForecast);
skill.registerAPI('getLifeAdvice', getLifeAdvice);
skill.registerAPI('getAirQuality', getAirQuality);
skill.registerAPI('getWeatherWarnings', getWeatherWarnings);
