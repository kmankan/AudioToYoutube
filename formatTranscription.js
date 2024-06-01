const fs = require('fs').promises;
const { describe } = require('node:test');
const path = require('path');
const MY_API_KEY = 'hWgWgh3fZQuoofiUP0oxe7aaoekEM1iL'
const OpenAI = require("openai").default;

async function formatTranscription() {
  try {
    const transcription = await fs.readFile('./output/Breath and Change - Guided Meditation - 30.00 - Kynan Tan - 2023-07-27.txt', 'utf-8');
    const openai = new OpenAI({
      apiKey: MY_API_KEY,
      baseURL: "https://api.lemonfox.ai/v1",
    });

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are an exceptionally helpful assistant that excels at summarising conversations succintly and formatting documents well." },
        { role: "user", content:
        `
        ${transcription}
        This is a transcription from a voice conversation. It is a text output with no formatting. 
        I would like you to format it so that it is more readable.
        Next I would like you to display to me an object literal with the following key-value pairs.
        (For each value I have specified the action you should take):
        title: create a title for this conversation (this should be a string), 
        description: summarise the conversation into a single paragraph that captures just the key points and takeaways. ((this should be a string), 
        keywords: assume this will be uploaded to YouTube, create a few of tags to capture keywords from the conversation (comma separated string),
        
        Your output should be the formatted conversation and the object literal
        
        ` },
      ],
      model: "llama-70b-chat",
    });

    console.log(completion)
    const formattedTranscription =  completion.choices[0].message.content;
    console.log(formattedTranscription);
    return formattedTranscription;

    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
}

formatTranscription();