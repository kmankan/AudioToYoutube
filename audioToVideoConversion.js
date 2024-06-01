const fs = require('fs').promises;
const { describe } = require('node:test');
const path = require('path');
const MY_API_KEY = 'hWgWgh3fZQuoofiUP0oxe7aaoekEM1iL'
const { spawn } = require('child_process');

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

async function main() {
  try {
    // Read all files in the current directory
    const folderPath = './short_guided_meditation_audio_only/test';
    const imageFilePath = './kynantan_still.png';
    const audioFilePath = './short_guided_meditation_audio_only/Breath and Change - Guided Meditation - 30.00 - Kynan Tan - 2023-07-27.mp3';
    const outputFilePath = './output/breath.mp4';

    // run video conversion to mp4
    await createVideo(imageFilePath, audioFilePath, outputFilePath);
  }
  
  catch (error) {
    console.error('Error:', error);
  }
}

main();