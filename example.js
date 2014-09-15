var fs = require("fs");
var colorExtractor = require("./css_color_extractor.js");


fs.readFile("C:\\Users\\smiller\\Desktop\\all_kb.css", "utf8", function (err,data) {
  if (err) {
    return console.log(err);
  }
  finalRulesets = colorExtractor.extractCss(data, console.log); //This is as far as I've gotten
  //finalRulesets = colorExtractor.extractCss(data); //This is as far as I've gotten
  
});
