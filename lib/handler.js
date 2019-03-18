const tinify = require('tinify');
const fs = require('fs');
const path = require('path');
const imageinfo = require('imageinfo');
const inquirer = require('inquirer');
const md5 = require('md5');
const {
  checkApiKey,
  getKeys,
  KEY_FILE_PATH
} = require('./util');


// 对当前目录内的图片进行压缩
const compress = async (newPath = '') => {
  newPath = path.join(process.cwd(), newPath);
  mkDir(newPath);

  const imageList = readDir();
  if (imageList.length === 0) {
    console.log('当前目录内无可用于压缩的图片');
    return;
  }
  await findValidateKey();
  console.log('===========开始压缩=========');
  if (newPath !== process.cwd()) {
    console.log('压缩到：  ' + newPath.replace(/\./g, ''));
  }
  compressArray(imageList, newPath);
};

// 生成目录路径
const mkDir = (filePath) => {
  if (filePath && dirExists(filePath) === false) {
    fs.mkdirSync(filePath);
  }
};

// 判断目录是否存在
const dirExists = (filePath) => {
  let res = false;
  try {
    res = fs.existsSync(filePath);
  } catch (error) {
    console.log('非法路径');
    process.exit();
  }
  return res;
};

/**
 * 找到可用的api-key
 */
const findValidateKey = async _ => { // bug高发处
  const keys = getKeys();
  let newKeys = getKeys();
  for (let i = 0; i < keys.length; i++) {
    await checkApiKey(keys[i]);
    let surplusCount = 500 - tinify.compressionCount;
    if (surplusCount > 0) {
      return;
    } else {
      //把用完的key移到最后
      newKeys.splice(i, 1);
      newKeys.push(keys[i]);
      console.log(newKeys);
      fs.writeFileSync(KEY_FILE_PATH, newKeys.join(' '));
    }
  }
  console.log('已存储的所有api-key都超出了本月500张限制，如果要继续使用请添加新的api-key');
  process.exit();
};

const readFileList = (_path, filesList) => {
  var files = fs.readdirSync(_path);
  files.forEach(function (itm, index) {
    if (['node_modules', 'dist'].indexOf(itm) == -1) {
      var stat = fs.statSync(path.join(_path, itm));
      if (stat.isDirectory()) {
        //递归读取文件
        readFileList(path.join(_path, itm), filesList);
      } else {

        var obj = {}; //定义一个对象存放文件的路径和名字
        obj.path = _path; //路径
        obj.filename = itm; //名字
        filesList.push(obj);
      }
    }
  });
};

const readManifest = filePath => {
  let manifestPath = path.join(filePath, 'manifest.json');
  let manifestContent = '';
  if (fs.existsSync(manifestPath)) {
    manifestContent = fs.readFileSync(path.join(filePath, 'manifest.json'), 'utf-8');
  }
  let manifest = manifestContent ? JSON.parse(manifestContent) : [];
  return manifest;
};

// 获取当前目录的所有png/jpg文件
const readDir = () => {
  const filePath = process.cwd();
  let filesList = [];
  readFileList(filePath, filesList);
  filesList = filesList.filter(item => {
    if (/(\.png|\.jpg|\.jpeg)$/.test(item.filename)) {
      let filePath = path.join(item.path, item.filename);
      const fileInfo = fs.readFileSync(filePath);
      const info = imageinfo(fileInfo);
      return /png|jpg|jpeg/.test(info.mimeType);
    }
    return false;
  });
  return filesList;
};

/**
 * 对数组内的图片名进行压缩
 * @param {*} imageList 存放图片名的数组
 * @param {*} newPath 压缩后的图片的存放地址
 */
const compressArray = async (imageList, newPath) => {
  const failList = [];
  for (let i = 0; i < imageList.length; i++) {
    try {
      if (500 - tinify.compressionCount <= 0) {
        await findValidateKey();
      }
      await compressImg(path.join(imageList[i].path, imageList[i].filename), imageList.length, failList, newPath);
    } catch (err) {
      if (err.status === 429) {
        //Your monthly limit has been exceeded
        await findValidateKey();
      }
    }
  }
  finishcb(failList, newPath);
};

/**
 * 压缩给定名称的图片
 * @param {*} name 文件名
 * @param {*} fullLen 全部文件数量
 * @param {*} failsList 压缩失败的数组
 * @param {*} filePath 用来存放的新地址
 */
const compressImg = (name, fullLen, failsList, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      fs.readFile(name, function (err, sourceData) {
        if (err) throw err;
        let key = md5(sourceData);
        // 读取当前目录下的manifest
        let manifest = readManifest(path.parse(name).dir);
        record(name, true, failsList.length, fullLen);
        if (manifest.indexOf(key) === -1) {
          tinify.fromBuffer(sourceData).toBuffer(function (err, resultData) {
            if (err) {
              reject(err);
              return;
            }
            const writerStream = fs.createWriteStream(name);
            // 标记文件末尾
            writerStream.write(resultData, 'binary');
            writerStream.end();
            // 处理流事件 --> data, end, and error
            writerStream.on('finish', function () {
              let key = md5(resultData);
              manifest.push(key);
              failsList.push(null);
              // record(name, true, failsList.length, fullLen);
              fs.writeFileSync(path.join(path.parse(name).dir, 'manifest.json'), JSON.stringify(manifest));
              resolve();
            });

            writerStream.on('error', function (err) {
              failsList.push(name);
              // record(name, false, failsList.length, fullLen);
              reject(err);
            });
          });
        } else {
          failsList.push(null);
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
};

// 生成日志
const record = (name, success = true, currNum, fullLen) => {
  console.log(`${name}  ${currNum+1}/${fullLen}`);
};

/**
 * 完成调用的回调
 * @param {*} failList 存储压缩失败图片名的数组
 * @param {*} filePath 用来存放的新地址
 */
const finishcb = (failList, filePath) => {
  const rest = 500 - tinify.compressionCount;
  console.log('本月剩余次数：' + rest);
  console.log('======done======');
};

module.exports = {
  compress
};
