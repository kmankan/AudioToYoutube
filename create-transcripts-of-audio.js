const fs = require('fs').promises;
const { describe } = require('node:test');
const path = require('path');
const MY_API_KEY = 'hWgWgh3fZQuoofiUP0oxe7aaoekEM1iL'
const { spawn } = require('child_process');


async function uploadAudio(fileNames, folderPath) {
  for (const fileName of fileNames) {
    try {
      console.log(fileName)
      const filePath = path.join(folderPath, fileName);
      const fileBuffer = await fs.readFile(filePath);
      const blob = new Blob([fileBuffer]);

      const body = new FormData();
      body.append('file', blob, fileName);
      body.append('language', 'english');
      const response_type = 'text'
      body.append('response_format', response_type);
      console.log(body)

      const response = await fetch('https://api.lemonfox.ai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MY_API_KEY}`
        },
        body: body
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      console.log('API Response:', data);

      const transcriptionFileName = fileName.replace('.mp3', '.txt');
      console.log(transcriptionFileName)
      const directoryPath = './output'
      const fullPath = path.join(directoryPath,transcriptionFileName)
      console.log(fullPath);
      await fs.writeFile(fullPath, data);
      console.log(`Transcription saved to ${transcriptionFileName}`);
      return data;

    } catch (error) {
      console.error('Error:', error);
    }
  }
}

async function formatTranscription(transcription) {
  try {
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

async function createSummaryData(transcription) {
  try {
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
        This is a transcription from a voice conversation. 
        I would like you to return an object literal with the following key-value pairs.
        (For each value I have specified the action you should take):
        title: create a title for this conversation (this should be a string), 
        description: summarise the conversation into a single paragraph that captures just the key points and takeaways. ((this should be a string), 
        keywords: assume this will be uploaded to YouTube, create a few of tags to capture keywords from the conversation. make sure you always include
        the default keywords "meditation" and "guided meditation" and come up with 4 others that are relevant (comma separated string),  
        ` 
        },
      ],
      model: "llama-70b-chat",
    });

    console.log(completion)
    const summaryObject =  completion.choices[0].message.content;
    console.log(summaryObject);
    return summaryObject;

    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
}

async function getMP4ImageFilePath(imageFolderPath) {
  const images = await fs.readdir(imageFolderPath);

  // Filter the files to find the first image file (assuming there's only one)
  const stillImageForMP4 = images.find(file => {
    const extname = path.extname(images).toLowerCase();
    return ['.jpg', '.jpeg', '.png'].includes(extname);
  });

  if (!stillImageForMP4) {
    throw new Error('No image file found in the specified folder');
  }

  const mp4ImageFilePath = path.join(imageFolderPath, stillImageForMP4);
  return mp4ImageFilePath;
}

async function createVideo(imageFilePath, audioFilePath, outputFilePath) {
  return new Promise((resolve, reject) => {
    // Specify the ffmpeg command and arguments
    const ffmpegCommand = 'ffmpeg';
    const args = [
      '-loop', '1',
      '-y',
      '-i', imageFilePath,
      '-i', audioFilePath,
      '-shortest',
      outputFilePath
    ];

    // Spawn a new process to execute the ffmpeg command
    const ffmpegProcess = spawn(ffmpegCommand, args);

    // Handle process events
    ffmpegProcess.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    ffmpegProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`ffmpeg process exited with code ${code}`);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Video creation failed'));
      }
    });
  });
}

async function processFiles(folderPath) {
  try {
    //Read all the files in the directory
    files = await fs.readdir(folderPath);
    const recordings = files.filter(file => path.extname(file).toLowerCase() === '.mp3');
    console.log('recordings', recordings, recordings.length);

    // for each file create a new folder, 
    // copy the mp3 into this folder, 
    // run transcription on this file and store output
    // run the transcription output through an LLM to get title, summary, tags
    // run video conversion to mp4,

    for (const fileName of recordings) {
      // extract the name of the file without extensions
      const folderName = path.parse(fileName).name;
      // define a new folder path -- sub folder in current location
      const newFolderPath = path.join(folderPath, folderName);
      // create new folder
      await fs.mkdir(newFolderPath);

      // copy the mp3 into the folder
      const sourcePath = path.join(folderPath, fileName);
      const destinationPath = path.join(newFolderPath, fileName);
      await fs.rename(sourcePath, destinationPath);
      
      // run transcription on this file and store the output
      const transcriptionData = await uploadAudio(recordings, folderPath);

      // run the transcription output through an LLM to get a formatted transcrition
      const formattedTranscriptionToSave = await formatTranscription(transcriptionData);
      // write the transcript to a .txt file

      // run the transcription output through an LLM to get summary objects
      const summaryInformationForUpload = await createSummaryData(transcriptionData);
      // write the summary object to a .txt file

      // run the create video terminal command to convert to mp4
      // pass the image file path in explicitly,
      // audio input and output paths are taken from above
      try {
        await createVideo(
          getMP4ImageFilePath('./image/'),
          destinationPath,
          newFolderPath
        );
        console.log('Video created successfully');
      } catch (error) {
        console.error('Error creating video:', error);
      }
      
  }
} catch (error) {
  console.error('Error:', error);
  }
}


// function that takes each file in the folder and passes it to the uploadAudio function for transcription
// Read all .mp3 files in the current directory
async function main() {
  try {
    // Read all files in the current directory
    const folderPath = './short_guided_meditation_audio_only/test';
    console.log(recordings, recordings.length);

    // run the function that will process each file
    await processFiles(folderPath);

  }
  
  catch (error) {
    console.error('Error:', error);
  }
}

main();