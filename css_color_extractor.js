var jscssp = require('./lib/jscssp');
var stringifyObject = require('stringify-object');
var css = require('css');

String.prototype.paddingLeft = function (paddingValue) {
   return String(paddingValue + this).slice(-paddingValue.length);
};

Array.prototype.inArray = function(valeur) {
	for (var i in this) { if (this[i] === valeur) return true; }
	return false;
};

Array.prototype.equals = function(arr) {
    return JSON.stringify(this)==JSON.stringify(arr);
};


var ruleTypes = {
	style: 1,
	charset: 2,
	"import": 3,
	media: 4,
	fontface: 5,
	page: 6,
	keyframes: 7,
	keyframe: 8,
	namespace: 100,
	comment: 101,
	whitespace: 102,
	variables: 200,
	declaration: 1000,
	unknown: 0
};

var supportedRuleTypes = [ruleTypes.style, ruleTypes.media];

//Pass these in?
var lookupRules = ["color"];
var excludedRules = ["-moz-initial", "transparent", "-moz-use-text-color"];
var uniqueColors = [];
var convertToGrayscale = true;
var showOnlyMediaQueries = false;

function extractCss(styleSheetText, callback){
	var parser = new jscssp.CSSParser();
	var normalizeStyleSheetText = normalizeStyleSheet(styleSheetText);
	var styleSheet = parser.parse(normalizeStyleSheetText, false, true);
	//prettyPrint(styleSheet);
	
	var cssRules = styleSheet.cssRules,
		rulesetCollection = [],
		combined = [],
		cssText = "",
		currentRulesetIndex = 0,
		lastRuleType,
		lastMediaValue;
	for(var ruleIndex=0, ruleIndexMax=cssRules.length; ruleIndex<ruleIndexMax; ruleIndex++){
		var cssRule = cssRules[ruleIndex],
			ruleType = cssRule.type,
			media = extractMedia(cssRule.media),
			isSupportedType = supportedRuleTypes.inArray(ruleType);

		if(isSupportedType){
		
			if(lastMediaValue != media){
				if(ruleIndex != 0) currentRulesetIndex += 1;
				rulesetCollection[currentRulesetIndex] = new StyleRuleSet(media);
			}
			
			addStyleRule(cssRule, rulesetCollection[currentRulesetIndex]);
			lastRuleType = ruleType;
			lastMediaValue = media;
		}
	}
	combined = combineLikeRulesets(rulesetCollection);
	cssText = finalTouchup(combined);
	
	if (typeof(callback) == "function"){
		callback(cssText);
	}
	else{
		return cssText;
	}
}



function finalTouchup(cssText){
	cssText = normalizeStyleSheet(cssText);
	
	uniqueColors.sort();
	cssText = "/*\nColors in this style sheet\n\n" + uniqueColors.join("\n") + "\n\n*/\n\n" + cssText;
	return cssText;
}

function combineLikeRulesets(rulesetCollection){
	var combinedCssText = "";
	for(var sfri=0, sfriMax = rulesetCollection.length; sfri < sfriMax; sfri++){
		var  uniqueRules = {}, combinedUniqueRules = {}, ruleset = rulesetCollection[sfri], cssText = "";
		if(ruleset && ruleset.styleRules){
			for(var i=0, max=ruleset.styleRules.length; i < max; i++){
				var result = ruleset.styleRules[i];
				if(result.selectors && result.selectors.length){
					var key = result.selectors.join(",");
					if(uniqueRules[key] === undefined){
						uniqueRules[key] = [];
					}
					uniqueRules[key].push(result.declaration);
				}
			}
		}
	
		
		for(var sel in uniqueRules){
			combinedUniqueRules[sel] = combineBorderColors(uniqueRules[sel]);
		}
		
		for(var key in combinedUniqueRules){
			cssText += key + "{" + combinedUniqueRules[key].join(" ") + "}";
		}
		if(ruleset && ruleset.media != "" && cssText !== ""){
			cssText = "@media " + ruleset.media + " {" + cssText + " }";
		}
		else if(showOnlyMediaQueries){
			cssText = "";
		}
	
		combinedCssText += cssText;
	}
	

	
	return combinedCssText;
}

function combineBorderColors(declarations){
	var combined = [], regex = /border-\w+?-color/;
	for(var i=0, max = declarations.length; i<max; i++){
		var current = declarations[i];
		var parts = current.split(":");

		if(regex.test(parts[0]) && max >= (i + 3)){
			var testColor = parts[1], hasFourBordersSame = true;
			for(var c = 1; c <= 3; c++){
				var next = declarations[i+c];
				if(next === undefined || !next.split(":")[0] || !regex.test(next.split(":")[0]) || next.split(":")[1] !== testColor){
					hasFourBordersSame = false;
					break;
				}
			}
			if(hasFourBordersSame){
				combined.push("border-color:" + testColor)
				i += 3;
			}
			else{
				combined.push(current);
			}
		}
		else{
			combined.push(current);
		}
	}
	return combined;
}


function normalizeStyleSheet(styleSheetText){
	var obj = css.parse(styleSheetText);
	var normalizedText = css.stringify(obj);
	return normalizedText;
}

function extractMedia(media){
	if(media && media.length != 0){
		return media[0];
	}
	return "";
}

function addStyleRule(cssRule, currentRuleset){
	
	var allRules;
	
	if(cssRule.declarations !== undefined) {
		allRules = [cssRule];
	}
	else if(cssRule.cssRules && cssRule.cssRules.length){
		allRules = cssRule.cssRules;
	}
	
	if(!allRules) return;


	for(var ci=0, ciMax = allRules.length; ci < ciMax; ci++){
		var rule = allRules[ci];
		var declarations = rule.declarations;
		if(!declarations){
			continue;
		}
		
		var selector = rule.mSelectorText;
		for(var current=0, currentMax = declarations.length; current < currentMax; current++){
			var declaration = declarations[current];
			
			if(declaration.parsedCssText && lookupRulePasses(declaration)){
				var normalDeclaration = normalizeDeclarationText(declaration);
				var styleRule = new StyleRule(normalDeclaration);
				styleRule.addSelector(selector);
				currentRuleset.addStyleRule(styleRule);
			}
		}
	}
}

function lookupRulePasses(declaration){
	for(var i=0, max = lookupRules.length; i<max; i++){
		var lookupRule = lookupRules[i];
		if(declaration.property && 
		   declaration.property.indexOf(lookupRule) != -1 && 
		   excludeRule(declaration.valueText)){
			return true;
		}
	}
	return false;
}

function normalizeDeclarationText(declaration){
	var testVal = declaration.valueText.trim(), match, hex, useTestVal = true,
		regex = /#([a-fA-F0-9]{3})$/, 
		hexRregex = /#([a-fA-F0-9]{6})$/, 
		rgbRegex = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/, 
		hslRegex = /hsl\(\s*(\d+)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\)/,
		outProp = declaration.parsedCssText;
	
	if(regex.test(testVal)){
		match = regex.exec(testVal);
		var r = match[1][0];
		var g = match[1][1];
		var b = match[1][2];
		hex = testConvertToGrayscale("#"+(r+r+g+g+b+b).toLowerCase());
		outProp = declaration.property + ": " + hex + ";";
		useTestVal = false;
	} else if(rgbRegex.test(testVal)){
		match = rgbRegex.exec(testVal);
		hex = testConvertToGrayscale(convertRgbToHex(match[1], match[2], match[3]));
		outProp = declaration.property + ": " + hex + ";";
		useTestVal = false;
	} else if(hslRegex.test(testVal)){
		match = hslRegex.exec(testVal);
		hex = testConvertToGrayscale(convertHslToHex(match[1], match[2], match[3]));
		outProp = declaration.property + ": " + hex + ";";
		useTestVal = false;
	}else if(hexRregex.test(testVal)){
		hex = testConvertToGrayscale((testVal).toLowerCase());
		outProp = declaration.property + ": " + hex + ";";
		useTestVal = false;
	} else if(colorNameToHex(testVal)){
		hex = testConvertToGrayscale(colorNameToHex(testVal));
		outProp = declaration.property + ": " + hex + ";";
		useTestVal = false;
	}
	
	if(useTestVal && !uniqueColors.inArray(testVal)){
		uniqueColors.push(testVal);
	}
	else if(hex && !uniqueColors.inArray(hex)){
		uniqueColors.push(hex);
	}

	return outProp;
}

function convertRgbToHex(r, g, b){
	r = parseInt(r, 10).toString(16).paddingLeft("00");
	g = parseInt(g, 10).toString(16).paddingLeft("00");
	b = parseInt(b, 10).toString(16).paddingLeft("00");
	return ("#" + r+g+b).toLowerCase();
}

function convertHslToHex(h, s, l){
	var m1, m2, hue, r, g, b
    s /=100;
    l /= 100;
    if (s == 0)
        r = g = b = (l * 255);
    else {
        if (l <= 0.5)
            m2 = l * (s + 1);
        else
            m2 = l + s - l * s;
        m1 = l * 2 - m2;
        hue = h / 360;
        r = Math.round(hueToRgb(m1, m2, hue + 1/3));
        g = Math.round(hueToRgb(m1, m2, hue));
        b = Math.round(hueToRgb(m1, m2, hue - 1/3));
    }
    return convertRgbToHex(r, g, b);
}

function hueToRgb(m1, m2, hue) {
    var v;
    if (hue < 0)
        hue += 1;
    else if (hue > 1)
        hue -= 1;

    if (6 * hue < 1)
        v = m1 + (m2 - m1) * hue * 6;
    else if (2 * hue < 1)
        v = m2;
    else if (3 * hue < 2)
        v = m1 + (m2 - m1) * (2/3 - hue) * 6;
    else
        v = m1;

    return 255 * v;
}

function testConvertToGrayscale(hex)
{
	if(convertToGrayscale){
		var redIntensity = parseInt(hex.substr(1,2), 16), greenIntensity = parseInt(hex.substr(3,2), 16), blueIntensity = parseInt(hex.substr(5,2), 16);
		var gray = (redIntensity * 0.3) + (greenIntensity * 0.59) + (blueIntensity * 0.11);
		var grayHex = (parseInt(gray)).toString(16).paddingLeft("00").toLowerCase();
		return "#" + grayHex + grayHex + grayHex;
	}
	return hex;
}

function excludeRule(test){
	test = test.toLowerCase();
	for(var i=0, max = excludedRules.length; i<max; i++){
		var excludedRule = excludedRules[i];
		if(test && test.indexOf(excludedRule) != -1){ 
			return false; 
		}
	}
	
	return true;
}


function StyleRule(declaration){
	if(!declaration){
		throw "StyleRule requires a declaration";
	}
	this.declaration = declaration;
	this.selectors = [];
}

StyleRule.prototype.addSelector = function(selector){
	if(!this.selectors.inArray(selector)){
		this.selectors.push(selector);
	}
};

function StyleRuleSet(media){
	this.media = media || "";
	this.styleRules = [];
}

StyleRuleSet.prototype.addStyleRule = function(styleRule){
	var currentStyleRule;
	for(var sri = 0, srMax = this.styleRules.length; sri < srMax; sri++) {
		if(styleRule.declaration == this.styleRules[sri].declaration){
			currentStyleRule = this.styleRules[sri];
			break;
		}
	}
	
	if(currentStyleRule && currentStyleRule.selectors){
		for(var i = 0, max = styleRule.selectors.length; i < max; i++) {
			var selector = styleRule.selectors[i];
			if(!currentStyleRule.selectors.inArray(selector)){
				currentStyleRule.addSelector(selector);
			}
		}
	}
	else{
		this.styleRules.push(styleRule);
	}
};

function prettyPrint(obj){
	var pretty = stringifyObject(obj, {
		indent: '  ',
		singleQuotes: false
	});
	console.log(pretty);
}

function colorNameToHex(color)
{
    var colors = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
    "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
    "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
    "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgrey":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
    "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkslategrey":"#2f4f4f","darkturquoise":"#00ced1",
    "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dimgrey":"#696969","dodgerblue":"#1e90ff",
    "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
    "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","grey":"#808080","green":"#008000","greenyellow":"#adff2f",
    "honeydew":"#f0fff0","hotpink":"#ff69b4",
    "indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
    "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
    "lightgrey":"#d3d3d3","lightgray":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightslategrey":"#778899","lightsteelblue":"#b0c4de",
    "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
    "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
    "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
    "navajowhite":"#ffdead","navy":"#000080",
    "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
    "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
    "red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
    "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","slate":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
    "tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
    "violet":"#ee82ee",
    "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
    "yellow":"#ffff00","yellowgreen":"#9acd32"};

    if (typeof colors[color.toLowerCase()] != 'undefined')
        return colors[color.toLowerCase()];

    return false;
}


if (typeof exports != "undefined") {
  exports.extractCss = extractCss;
}