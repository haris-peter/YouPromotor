import Ffmpeg from "fluent-ffmpeg";

Ffmpeg.getAvailableFormats(function(err, formats) {
    console.log('Available formats:');
    console.dir(formats);
  });