const fs = require('fs').promises;
const { describe } = require('node:test');
const path = require('path');
const MY_API_KEY = 'hWgWgh3fZQuoofiUP0oxe7aaoekEM1iL'
const { spawn } = require('child_process');
const OpenAI = require("openai").default;


async function uploadAudioForTranscription(fileNames, folderPath, ) {
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
      const directoryPath = folderPath;
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
        { role: "system", content: "You are an exceptionally helpful assistant that excels at summarising conversations succintly and formatting documents well" },
        { role: "user", content: 
        `
        ${transcription}
        This is a transcription from a voice conversation. It is a text output with no formatting. 
        I would like you to format it so that it is more readable.       
        
        Your output should be only the formatted conversation and nothing else. No additional words.
        
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
        I would like you to return a JSON object with the following key-value pairs:
        - "title": a title for this conversation (string),
        - "description": a single paragraph that summarizes the key points and takeaways of the conversation (string),
        - "keywords": 5-6 relevant keywords for the conversation, including "meditation" and "guided meditation" (comma-separated string),
    
        Please generate the JSON object without any escape characters or newline symbols. The JSON should be formatted with regular spaces and line breaks for readability. The output should be only the JSON object and other words.
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
    const extname = path.extname(file).toLowerCase();
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
      console.log(destinationPath, '\n\n',newFolderPath);
      
      // timestamp
      const timestamp = Date.now()

      // run transcription on this file and store the output
      const transcriptionData = await uploadAudioForTranscription(recordings, newFolderPath);

      // run the transcription output through an LLM to get a formatted transcrition
      const formattedTranscriptionToSave = await formatTranscription(transcriptionData);
      // write the transcript to a .txt file
      const audioTranscriptfileName = `audioTranscript_${timestamp}.txt`;
      const audioTranscriptFilePath = path.join(newFolderPath, audioTranscriptfileName);
      try {
        await fs.writeFile(audioTranscriptFilePath, formattedTranscriptionToSave);
        console.log(`Transcript saved to ${audioTranscriptfileName}`);
      } catch (error) {
        console.error('Error writing transcript file:', error);
      }

      // run the transcription output through an LLM to get summary objects
      const summaryInformationForUpload = await createSummaryData(transcriptionData);
      // write the summary object to a .json file
      const metadataFileName = `videoMetadata_${timestamp}.json`;
      const metatdataFilePath = path.join(newFolderPath, metadataFileName);
      try {
        await fs.writeFile(metatdataFilePath, summaryInformationForUpload,);
        console.log(`Summary information saved to ${metatdataFilePath}`);
      } catch (error) {
        console.error('Error writing transcript file:', error);
      }
      
      // run the create video terminal command to convert to mp4
      // pass the image file path in explicitly,
      // audio input and output paths are taken from above
      // try {
      //   const stillImageFilePath = await getMP4ImageFilePath('./image/');
      //   const mp4filePath = path.join(newFolderPath, 'convertedVideo.mp4');

      //   console.log('image path :>> ', stillImageFilePath);
      //   console.log('input path :>> ', destinationPath);
      //   console.log('output path :>> ', newFolderPath, mp4filePath);
      //   await createVideo(
      //     stillImageFilePath,
      //     // check whether the audio file is actually here now
      //     destinationPath,
      //     mp4filePath
      //   );
      //   console.log('Video created successfully');
      // } catch (error) {
      //   console.error('Error creating video:', error);
      // }
      
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

    // run the function that will process each file
    await processFiles(folderPath);
  }

  catch (error) {
    console.error('Error:', error);
  }
}

main();