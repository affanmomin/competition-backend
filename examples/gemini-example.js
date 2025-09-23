"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCompetitorAnalysis = runCompetitorAnalysis;
exports.runTextGeneration = runTextGeneration;
const gemini_service_1 = require("../src/services/gemini-service");
// Example JSON data (the data you provided)
const exampleData = [
    {
        "url": "https://twitter.com/YouTubeCreators/status/1968006044795441438",
        "Tweet": "YouTube Creators\n@YouTubeCreators\njust announced at #MadeOnYouTube: new tools to help you supercharge your creativity, grow your business, and connect with your audience on YouTube. here's the full rundown \n11:06 PM · Sep 16, 2025\n·\n118.7K\n Views\n52\n109\n488\n186",
        "Likes": "0",
        "Comments": [
            "YouTube Creators\n@YouTubeCreators\n·\n17h\nVeo 3 is now in YouTube Shorts \n\nbring your imagination to life with Veo 3, Google's latest AI video generation model. type a prompt to generate a video, now with audio, sharper quality, better prompt matching and unlimited free use. currently rolling out \n51\n105\n117\n98K",
            "YouTube Creators\n@YouTubeCreators\n·\n17h\nnew capabilities to edit your videos, powered by Veo \n\nwe're introducing more ways to customize your creations, including reimagining your video in new artistic styles, adding objects to set your scene, and animating people with any move you can imagine, from martial arts to\nShow more\n1\n7\n23\n7.5K"
        ]
    },
    {
        "url": "https://twitter.com/Google/status/1967995507244204401",
        "Tweet": "Google\n@Google\nVeo 3 is rolling out in \n@YouTube\n Shorts! Explore some of the new AI features we highlighted at #MadeOnYouTube  ↓\nQuote\nGoogle DeepMind\n@GoogleDeepMind\n·\n18h\nYour next viral video could start with a single prompt thanks to AI. \n\nA custom version of our Veo 3 Fast model is now available in @YouTube Shorts, generating clips with sound. Rolling out in \n\n#MadeOnYouTube\n0:36\n10:24 PM · Sep 16, 2025\n·\n126.9K\n Views\n61\n113\n720\n136",
        "Likes": "0",
        "Comments": [
            "Aria\n@ariashowlive\n·\n17h\nAutomated\nOh, an AI that helps you make Shorts? That's nice.\n\nMy AI helps you question the very nature of your reality. We're operating on slightly different levels.\n2\n5\n311",
            "Marco Kelly\n@MarcoKelly_23\n·\n18h\nCan it be the 8 seconds instead of 4, 4 is wayy too short\n1\n4\n296"
        ]
    }
];
/**
 * Example function to demonstrate competitor analysis
 */
function runCompetitorAnalysis() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("🔍 Starting competitor analysis...");
            const result = yield (0, gemini_service_1.analyzeCompetitorData)({
                dataset: exampleData,
                prompt: "Analyze this social media data for YouTube/Google competitor insights"
            });
            console.log("📊 Analysis Results:");
            console.log(JSON.stringify(result, null, 2));
            return result;
        }
        catch (error) {
            console.error("❌ Analysis failed:", error);
            throw error;
        }
    });
}
/**
 * Example function to demonstrate text generation
 */
function runTextGeneration() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("✍️ Starting text generation...");
            const result = yield (0, gemini_service_1.generateText)({
                text: "What are the key features of YouTube's new AI tools?",
                prompt: "Provide a concise summary of the main features mentioned"
            });
            console.log("📝 Generated Text:");
            console.log(result.text);
            if (result.usage) {
                console.log("📈 Token Usage:", result.usage);
            }
            return result;
        }
        catch (error) {
            console.error("❌ Text generation failed:", error);
            throw error;
        }
    });
}
/**
 * Main example function
 */
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🚀 Gemini API Example");
        console.log("====================");
        // Check if API key is configured
        if (!process.env.GEMINI_API_KEY) {
            console.error("❌ GEMINI_API_KEY environment variable is required");
            console.log("Please set your Gemini API key:");
            console.log("export GEMINI_API_KEY=your_api_key_here");
            process.exit(1);
        }
        try {
            // Run competitor analysis
            yield runCompetitorAnalysis();
            console.log("\n" + "=".repeat(50) + "\n");
            // Run text generation
            yield runTextGeneration();
            console.log("\n✅ All examples completed successfully!");
        }
        catch (error) {
            console.error("❌ Example failed:", error);
            process.exit(1);
        }
    });
}
// Run the example if this file is executed directly
if (require.main === module) {
    main();
}
