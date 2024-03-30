const express = require('express');
const axios = require('axios');
const session = require('express-session');//세션
const ejs = require('ejs') // npm install ejs _ 주소를 파일단위로 관리하고, 랜더링하기 위한 라이브러리 _ express에서 사용할 수 있는
const bodyParser = require('body-parser')
const mysqlConnection = require('./mysql')
const cors = require('cors'); // cor 패키지
const http = require('http') // cor와 함께 사용할 아이
const app = express();
const port = 5000;
const multer = require('multer');
const { match } = require('assert');

app.use(cors());

app.use(session({
    secret: 'secret key',	// 암호화
    resave: false,	
    saveUninitialized: true,	
    cookie: {	
      httpOnly: true,
    },
  }));

const connection = mysqlConnection.init();
mysqlConnection.open(connection);



app.set('view engine', 'ejs'); // 보여주는 싯기를 ejs쓸거야 명시
app.set('views', './views'); // views 라는 애들은, ./views 안에 있어
app.use(bodyParser.urlencoded({extended:false}));

const GOOGLE_CLIENT_ID = ''; // YOUR GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = '' // YOUR GOOGLE_CLIENT_SECRET;
const GOOGLE_LOGIN_REDIRECT_URI = 'http://localhost:5000/login/redirect';
const GOOGLE_SIGNUP_REDIRECT_URI = 'http://localhost:5000/signup/redirect';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

let user = {} ;

app.get('/login', (req, res) => {
    let url = 'https://accounts.google.com/o/oauth2/v2/auth';
    url += `?client_id=${GOOGLE_CLIENT_ID}`
    url += `&redirect_uri=${GOOGLE_LOGIN_REDIRECT_URI}`
    url += '&response_type=code'
    url += '&scope=email profile'    
    res.redirect(url);
});

app.get('/signup', (req, res) => {
    let url = 'https://accounts.google.com/o/oauth2/v2/auth';
    url += `?client_id=${GOOGLE_CLIENT_ID}`
    url += `&redirect_uri=${GOOGLE_SIGNUP_REDIRECT_URI}`
    url += '&response_type=code'
    url += '&scope=email profile'
    res.redirect(url);
});


app.get('/login/redirect', async (req, res) => {
    const { code } = req.query;

    const resp = await axios.post(GOOGLE_TOKEN_URL, {
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_LOGIN_REDIRECT_URI,
        grant_type: 'authorization_code',
    });

    const resp2 = await axios.get(GOOGLE_USERINFO_URL, {
        headers: {
            Authorization: `Bearer ${resp.data.access_token}`,
        },
    });

    const google_info = resp2.data;

    console.log(google_info);
    req.session.google_id = google_info.email; // 세션에 구글 아이디 저장

    // 디비에서 코드값과 일치하는 구글 아이디를 조회하는 쿼리 실행
    const sql = `SELECT * FROM users WHERE user_id = '${google_info.email}'`;
    // const sql = `SELECT user_id, user_nick FROM users WHERE user_id = '${google_info.email}'`;
    connection.query(sql, function(err, result) {
        if (err) throw err;

        if (result.length > 0) {

            console.log('result', result[0])
            const user_id = result[0].user_id;
            const user_nick = result[0].user_nick;

            user = result[0]

            // 세션에 구글 아이디 저장
            req.session.user_id = user_id;
            req.session.user_nick = user_nick;
            // console.log(`Google ID (${user_id}) and nickname (${user_nick}) stored in session.`);
            console.log(`Google ID (${req.session.user_id}) and nickname (${req.session.user_nick}) stored in session.`);
            req.session.save(()=>{
                res.send("<script>alert('로그인 성공'); location.href='http://210.183.87.94:3000'</script>");
            })
        }
        
    });
});

app.get('/signup/redirect', async (req, res) => {
    const { code } = req.query;

    const resp = await axios.post(GOOGLE_TOKEN_URL, {
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_SIGNUP_REDIRECT_URI,
        grant_type: 'authorization_code',
    });

    const resp2 = await axios.get(GOOGLE_USERINFO_URL, {
        headers: {
            Authorization: `Bearer ${resp.data.access_token}`,
        },
    });

    const google_info = resp2.data;

    console.log(google_info);
    // req.session.email = google_info.email; // 세션에 이메일 주소 저장
    

    res.render('npForm');
});

app.post('/first/login.js', (req, res) => {
    const email = req.session.email; // 세션에서 이메일 주소 추출
    const { nick, phone } = req.body;
    
    const sql = `INSERT INTO users (user_id, user_nick, user_phone, joined_at) VALUES ('${email}', '${nick}', '${phone}', NOW())`;
    connection.query(sql, function(err, result){
        if(err) throw err;
        console.log('자료 1개를 반환하였습니다.'); 
    });


    mysqlConnection.close;

    res.send("<script>alert('회원등록 완료 되었습니다.'); location.href='http://210.183.87.94:3000'</script>");
});


// 세션 리액트로 전송
app.get('/session', (req, res) => {


    console.log('session back 도착',user)
      const {user_id, user_nick, clan_boss}  = user; 
      let sessionObj = {
        user_id : user_id,
        user_nick : user_nick,
        clan_boss : clan_boss
      }
      res.json(sessionObj);

  });


//=======================================================


// 파일 저장을 위한 multer 설정
const storage = multer.diskStorage({
 
      destination: function (req, file, cb) {
        cb(null, 'uploads/') // 파일이 저장될 경로
      },
      filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now())
      }
    }
);

const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/board', upload.single('b_file'), async (req, res) => {
  try {
    // 요청 정보 출력
    console.log('요청 정보:', req.body);

    const { b_title, b_content, created_at } = req.body;
    const b_file = req.file ? req.file.path : '';
    const user_id = req.session.user_id;

    // SQL 쿼리 실행
    const query = 'INSERT INTO posts (b_title, b_content, b_file, created_at, user_id) VALUES (?, ?, ?, ?, ?)';
    const [result] = await pool.execute(query, [b_title, b_content, b_file, created_at, user_id]);

    // 응답 정보 출력
    console.log('응답 정보:', { message: '게시글이 성공적으로 등록되었습니다.', postId: result.insertId });

    res.status(200).json({ message: '게시글이 성공적으로 등록되었습니다.', postId: result.insertId });
  } catch (error) {
    // 오류 정보 출력
    console.error('오류 정보:', error);

    res.status(500).json({ message: '게시글 등록 중 오류가 발생했습니다.', error: error.message });
  }
});
// 댓글 등록 API 엔드포인트
app.post('/api/commentInsert', (req, res) => {
  const { b_idx, cmt_content, created_at, user_id } = req.body; // 클라이언트로부터 받은 데이터
  const query = 'INSERT INTO comments (b_idx, cmt_content, created_at, user_id) VALUES (?, ?, ?, ?)';

  connection.query(query, [b_idx, cmt_content, created_at, user_id], (err, result) => {
    if (err) {
      console.error('댓글 등록 중 에러 발생:', err);
      res.status(500).send('서버 에러');
    } else {
      res.send('댓글이 성공적으로 등록되었습니다.');

    }
  });

  
  const upload = multer({ storage: storage });
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // '/api/boardInsert' 경로에 대한 POST 요청 처리
  app.post('/api/boardInsert', upload.single('file'), (req, res) => {
    const nick = req.session.user_nick; // 세션에서 사용자 닉네임 가져오기 (사용자 인증 구현 필요)
    const user_id = req.body.user_id; // 사용자 ID 처리 (사용자 인증 구현 필요)
    const b_title = req.body.title;
    const b_content = req.body.content;
    const b_file = req.file ? req.file.path : ''; // 파일이 있다면 파일 경로 저장
    const b_created_at = new Date();

  
    // 데이터베이스 연결 및 쿼리 실행 코드 (여기서는 예시로만 표시)
    const sql = `INSERT INTO boards (b_title, b_content, b_file, created_at, user_id) 
                 VALUES (?, ?, ?, ?, ?)`;
    const values = [b_title, b_content, b_file, b_created_at, user_id];
  
    // 데이터베이스 쿼리 실행 (예시 코드)
    connection.query(sql, values, (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send('Error inserting data');
      } else {
        console.log('Data inserted successfully');
        res.sendStatus(200);
      }
    });
  });
  
  
    //   // 회원정보 수정

    app.post('/updateUser', (req, res) => {
    const { user_id, user_nick, user_phone } = req.body;
    const sql = "UPDATE users SET user_nick = ?, user_phone = ? WHERE user_id = ?";
    const values = [user_nick, user_phone, user_id];

    // 데이터베이스 라이브러리를 사용하여 쿼리 실행
    connection.query(sql, values, (err, result) => {
      if (err) throw err;
      // 쿼리 실행 결과 처리
      res.send('사용자 정보가 성공적으로 업데이트되었습니다.');
    });
  });


  // 서버 실행
app.listen(port, () => {
    console.log('server is running at 5000');});


});


// 댓글 리스트 API 앤드포인트
app.get('/api/comments/:idx', (req, res) => {
  const idx = req.params.idx;
  console.log(idx)

  const sql = ` SELECT c.*, u.user_nick
    FROM comments c INNER JOIN users u ON c.user_id = u.user_id WHERE c.b_idx = ${idx}`;

  connection.query(sql, (err, data) => {
    if (err) return res.json(err);
    return res.json(data)
  })
});

// 노드 특정 idx게시판 보기 앤드포인트
app.get('/api/board/:idx', (req, res) => {
  const idx = req.params.idx;
  console.log(idx)

  const sql = `SELECT b.*, u.user_nick FROM boards b INNER JOIN users u ON b.user_id = u.user_id WHERE b.b_idx = ${idx}`;

  connection.query(sql, (err, data) => {
    if (err) return res.json(err);
    return res.json(data)
  })
});



// 팀 정보 요청 앤드포인트
app.get('/api/teams',(req, res)=>{

  const sql = "SElECT * FROM teams WHERE team_idx <= 10";
  connection.query(sql,(err, data)=>{
    if(err) return res.json(err);
    return res.json(data)
  })
})

// 노드 팀 idx에 따른 팀정보 앤드포인트
app.get('/api/teaminfo/:team_idx', (req, res) => {
  const idx = req.params.team_idx;
  console.log(idx)
  const sql = `SELECT * FROM teams WHERE team_idx = ${idx}`;
  connection.query(sql, (err, data) => {
    if (err) return res.json(err);
    return res.json(data)
  })
})


// 일정 공유 파트

// Route to receive new schedule data from client and insert into database
app.post('/api/addSchedule', (req, res) => {

  // 세션에서 사용자 ID 가져오기
  // const userId = req.session.userId;

  // 세션에 저장된 사용자 ID를 이용해 데이터베이스에 새로운 일정 추가

  const query = 'INSERT INTO schedule (calendarType, title, startDate, endDate, time, location, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  const { calendarType, title, startDate, endDate, time, location, description } = req.body;

  connection.query(query, [ calendarType, title, startDate, endDate, time, location, description], (err, result) => {
    if (err) {
      console.error('일정 등록 중 에러 발생:', err);
      res.status(500).send('서버 에러');
    } else {
      console.log('일정이 성공적으로 등록되었습니다.');
      res.sendStatus(200);
    }
  });
});

// 일정 보여주는 코드

app.get('/api/getSchedule', (req, res) => {
  // 세션에서 사용자 ID 가져오기
  const userId = req.session.userId;

  // 데이터베이스에서 해당 사용자의 일정 가져오기
  const query = 'SELECT * FROM schedule WHERE userId = ?';
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('일정 조회 중 에러 발생:', err);
      res.status(500).send('서버 에러');
    } else {
      console.log('일정 조회 성공:', results);
      // 클라이언트에게 일정 데이터 전송
      res.status(200).json(results);
    }
  });
});

// 클랜 보드 리스트
app.get("/api/boardList", (req, res) => {
  const q = "SELECT * FROM boards";
  connection.query(q, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

// 서버 실행
app.listen(port, () => {
  console.log('server is running at 5000');
});

