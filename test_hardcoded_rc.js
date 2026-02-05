
const CLIENT_ID = 'ceEKax1k8x7aWXcxgumFvb';
const CLIENT_SECRET = '84NUkjaMKjmb3oGG61YkHFYG8thcHIg9UezjSOIK3qbf';
const JWT = 'eyJraWQiOiI4NzYyZjU5OGQwNTk0NGRiODZiZjVjYTk3ODA0NzYwOCIsInR5cCI6IkpXVCIsImFsZyI6IlJTMjU2In0.eyJhdWQiOiJodHRwczovL3BsYXRmb3JtLnJpbmdjZW50cmFsLmNvbS9yZXN0YXBpL29hdXRoL3Rva2VuIiwic3ViIjoiNjM3OTQ4NjAwMDciLCJpc3MiOiJodHRwczovL3BsYXRmb3JtLnJpbmdjZW50cmFsLmNvbSIsImV4cCI6MzkxNzQ1NjMzMiwiaWF0IjoxNzY5OTcyNjg1LCJqdGkiOiJCUFJnZlFvYVR1bU5aR2x2c0xKU1BnIn0.Gy1fHBIkcZI5xbCmgWB39rT0VRbip2Em6VMIG1p5zMiYuKz0xg4iIhNozkRJoN8ZJkU6IkTtasgt9pxFCxJe61YCQfk6EKKJmH5p-BH4ftXQtSDCyjS-Bg7wFJmpYLn3GWu3j-65MJ-_ISGcklwvlRM60wMBY611lk3uDGaufL4B7aqIMNfCsK29PCDFYhqlda0PxjP2anU2lhYaO5D0onhZDjrPRpUybbDxAoh-VTauXQyFa2qk2IFslo5TgdE_3s94XfCn2CARwSowkhpQX53SInO8fyk8jNtEWFeS0PZqzcyF8d8ET-UuEkwtoHWB-AnRsMRDyk4o22dInEktoQ';

async function test() {
    const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const resp = await fetch('https://platform.ringcentral.com/restapi/oauth/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion': JWT
        })
    });
}
test();
