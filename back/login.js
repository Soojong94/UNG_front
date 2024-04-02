const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysqlConnection = require('./mysql');
const cors = require('cors');
const app = express();
const port = 5000;
const multer = require('multer');
const bcrypt = require('bcrypt');
const util = require('util');
const axios = require('axios')
const path = require('path');

// MySQL 연결 초기화 및 오픈
const connection = mysqlConnection.init();
connection.query = util.promisify(connection.query); // Enable async/await for MySQL queries

// CORS 미들웨어 등록
// 서버에서 CORS 설정하기
app.use(
  cors({
    origin: 'http://localhost:3000', // 허용할 도메인
    credentials: true, // 쿠키를 주고받을 수 있도록 설정
  })
);

// 클라이언트에서 쿠키를 이용하여 서버에 요청 보내기
axios.defaults.withCredentials = true;

// Setup session middleware
app.use(session({
  secret: '121212',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
  },
}));

// 회원가입

// Middleware to parse request body
app.use(express.urlencoded({ extended: false }));
app.use(express.json());


// Error handling middleware

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Server Error');
});
// Handle duplicate error functionn
const handleDuplicateError = (results, user_id, user_nick, next) => {
  if (results[0].user_id === user_id) {
    return next(new Error('Duplicate ID'));
  } else if (results[0].user_nick === user_nick) {
    return next(new Error('Duplicate Nickname'));
  }
};

// Endpoint for user registration
app.post('/signup', async (req, res, next) => {
  const { user_id, user_nick, user_phone, user_pw } = req.body;
  const hashedPassword = await bcrypt.hash(user_pw, 10);

  try {
    const results = await connection.query('SELECT * FROM users WHERE user_id = ? OR user_nick = ?', [user_id, user_nick]);

    if (results.length > 0) {
      return handleDuplicateError(results, user_id, user_nick, next);
    } else {
      // Insert the new user into the database
      const newUser = {
        user_id,
        user_nick,
        user_phone,
        user_pw: hashedPassword,
        joined_at: new Date(),
        // Assume clan is defined somewhere or retrieved from request
        clan: null,
      };
      await connection.query('INSERT INTO users SET ?', newUser);

      // Save user data in session
      req.session.user = {
        user_id: newUser.user_id,
        user_nick: newUser.user_nick,
        joined_at: newUser.joined_at,
        clan: newUser.clan,
      };
      res.status(200).json({ message: 'Signup Successful' });
    }
  } catch (error) {
    return next(error);
  }
});


let user = {};

// Endpoint for user login
app.post('/login', async (req, res, next) => {
  const { userId, userPw } = req.body;
  connection.query('SELECT * FROM users WHERE user_id = ?', [userId], async (error, results) => {

    if (error) return next(error);
    if (results.length > 0) {
      const comparison = await bcrypt.compare(userPw, results[0].user_pw);
      if (comparison) {
        // Save user data in session
        req.session.user = {
          user_id: results[0].user_id,
          user_nick: results[0].user_nick,
          joined_at: results[0].joined_at,
          clan: results[0].clan,
          clan_boss: results[0].clan_boss,
        };
        user = req.session.user; // Save user data in global variable
        return res.status(200).send('Login Successful');
      } else {
        return res.status(401).send('Incorrect Password');
      }
    } else {
      return res.status(404).send('User Not Found');
    }
  });
});

// Endpoint to retrieve session data
app.get('/session', (req, res) => {
  console.log('session back 도착', user)
  const { user_id, user_nick, clan_boss, clan } = user;
  let sessionObj = {
    user_id: user_id,
    user_nick: user_nick,
    clan_boss: clan_boss,
    clan: clan,
  }
  res.json(sessionObj);
});

// Endpoint to check if user is logged in
app.get('/checkLogin', (req, res) => {
  if (req.session.user && req.session.user.user_id) {
    return res.send('User is logged in');
  } else {
    return res.send('User is not logged in');
  }
});

// 세션 종료를 처리하는 엔드포인트(로그아웃)
app.post('/logout', (req, res) => {
  req.session.user = null; // 세션 정보를 제거합니다.
  console.log('세션바이');
  return res.sendStatus(200);
});

//=======================================================

app.use('/uploads', express.static('uploads'));

// 파일저장 객체
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') // 파일이 저장될 경로
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + Date.now() + ext)
  }
});

const upload = multer({ storage: storage });


// (클랜)게시판(클랙제작) 작성 기능
app.post('/api/boardInsert', upload.single('file'), (req, res) => {
  const { title, content, userId, userCount } = req.body;
  const file = req.file ? req.file.filename : null;
  const image = file ? '/uploads/' + file : null;



  const clansInsertSql = `INSERT INTO clans (clan_boss_id, clan_limit, clan_logo, clan_name, created_at)
  VALUES ('${userId}', ${userCount}, '${image}', '${title}', NOW())`;

  const boardsInsertSql = `INSERT INTO boards (b_content, b_file, b_title, user_id, created_at)
  VALUES ('${content}', '${image}', '${title}', '${userId}', NOW())`;

  const clanInfoUdate = `UPDATE users SET clan_boss = 'y', clan = '${title}' WHERE user_id = '${userId}';
`;

  connection.query(clansInsertSql, (err) => {
    if (err) {
      console.error('Error inserting data into clans table:', err);
      res.status(500).send('Error inserting data into clans table');
      return;
    }

    connection.query(boardsInsertSql, (err) => {
      if (err) {
        console.error('Error inserting data into boards table:', err);
        res.status(500).send('Error inserting data into boards table');
        return;
      }

      connection.query(clanInfoUdate, (err) => {
        if (err) {
          console.error('Error udate clanInfoUdate into users table', err);
          res.status(500).send('Error udate clanInfoUdate into users table:');
          return;
        }
      })

    

      res.status(200).send('Successfully inserted data');
    });
  });
});


// 댓글 작성 기능
app.post('/api/commentInsert', async (req, res) => {
  const { b_idx, user_id, cmt_content } = req.body;

  const created_at = new Date().toISOString(); // 댓글 작성 시간 생성

  // Construct comment data
  const newComment = {
    b_idx,
    user_id,
    cmt_content,
    created_at,
  };

  try {
    // Store the new comment in the database
    await connection.query(
      'INSERT INTO comments(b_idx, user_id, cmt_content, created_at) VALUES (?, ?, ?, ?)',
      [newComment.b_idx, newComment.user_id, newComment.cmt_content, newComment.created_at]
    );

    res.status(200).send('댓글이 성공적으로 등록되었습니다.');
  } catch (error) {
    console.error('댓글 등록 중 에러가 발생했습니다', error);
    res.status(500).send('댓글 등록에 실패했습니다.');
  }
});


// 댓글 리스트 API 앤드포인트
app.get('/api/comment/:idx', (req, res) => {
  const { idx } = req.params;
  console.log('댓글', idx)

  const sql = `SELECT c.*, u.user_nick
  FROM comments c INNER JOIN users u ON c.user_id = u.user_id WHERE c.b_idx = ${idx}
  ORDER BY c.cmt_idx DESC`;

  connection.query(sql, (err, data) => {
    if (err) return res.json(err);
    return res.json(data)
  })
});

// 팀 정보 요청 앤드포인트
app.get('/api/teams', (req, res) => {
  const sql = "SElECT * FROM teams WHERE team_idx <= 10";
  connection.query(sql, (err, data) => {
    if (err) return res.json(err);
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


// 일정등록
app.post('/api/addSchedule', (req, res) => {
  const { calendarType, st_dt, ed_dt, st_tm, ed_tm, sche_content, user_id } = req.body;
  console.log('캘린더타입', calendarType)

  if (calendarType === '1') {
    const query = 'INSERT INTO user_schedules (user_id, st_dt, ed_dt, st_tm, ed_tm, sche_content) VALUES (?, ?, ?, ?, ?, ?)';
    connection.query(query, [user_id, st_dt, ed_dt, st_tm, ed_tm, sche_content], (err, result) => {
      if (err) {
        console.error('개인일정 등록 중 에러 발생:', err);
        res.status(500).send('서버 에러');
      } else {
        console.log('개인일정이 성공적으로 등록되었습니다.');
        res.sendStatus(200);
      }
    });
  } else if (calendarType === '2') {
    const query = 'INSERT INTO clan_schedules (st_dt, ed_dt, st_tm, ed_tm, sche_content, user_id) VALUES (?, ?, ?, ?, ?, ?)';
    connection.query(query, [st_dt, ed_dt, st_tm, ed_tm, sche_content, user_id], (err, result) => {
      if (err) {
        console.error('클랜 일정 등록 중 에러 발생:', err);
        res.status(500).send('서버 에러');
      } else {
        const sche_idx = result.insertId;
        const shareQuery = 'INSERT INTO clan_schedule_shares (sche_idx, user_id, share_id) VALUES (?, ?, ?)';
        connection.query(shareQuery, [sche_idx, user_id, user_id], (shareErr, shareResult) => {
          if (shareErr) {
            console.error('클랜 일정 공유 중 에러 발생:', shareErr);
            res.status(500).send('서버 에러');
          } else {
            console.log('클랜 일정이 성공적으로 등록되었습니다.');
            res.sendStatus(200);
          }
        });
      }
    });
  }
});

// 클랜 일정 조회
app.get('/api/sharedSchedules/:userId', (req, res) => {
  const userId = req.params.userId;
  console.log(userId);

  const sql = `
  SELECT cs.* 
  FROM clan_schedules cs
  JOIN users u ON cs.user_id = u.user_id
  WHERE u.clan = (
    SELECT clan 
    FROM users 
    WHERE user_id = ?
  )
  `;
  connection.query(sql, [userId], (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
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

// 회원정보 수정 
app.post('/updateUser', (req, res) => {
  const { user_nick, user_phone } = req.body;

  // 세션에서 사용자 ID 가져오기
  const user_id = req.session.user_id;

  if (!user_id) {
    return res.status(400).send('사용자 ID가 없습니다.');
  }

  const sql = "UPDATE users SET user_nick = ?, user_phone = ? WHERE user_id = ?";
  const values = [user_nick, user_phone, user_id];

  // 데이터베이스 라이브러리를 사용하여 쿼리 실행
  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error('회원정보 업데이트 중 오류 발생:', err);
      return res.status(500).send('회원정보 업데이트 중 오류가 발생했습니다.');
    }
    // 쿼리 실행 결과 처리
    res.send('사용자 정보가 성공적으로 업데이트되었습니다.');
  });
});

// 회원 탈퇴 엔드포인트
app.delete('/userDelete/:user_id', (req, res) => {
  const userId = req.params.user_id;

  // 회원의 댓글 삭제
  const deleteCommentsQuery = 'DELETE FROM comments WHERE user_id = ?';
  connection.query(deleteCommentsQuery, [userId], (err, result) => {
    if (err) {
      console.error('Error deleting comments:', err);
      res.status(500).send({ message: 'Error occurred while deleting comments.' });
      return;
    }

    // 회원의 게시글 삭제
    const deleteBoardQuery = 'DELETE FROM boards WHERE user_id = ?';
    connection.query(deleteBoardQuery, [userId], (err, result) => {
      if (err) {
        console.error('Error deleting posts:', err);
        res.status(500).send({ message: 'Error occurred while deleting posts.' });
        return;
      }

      // 회원삭제
      const deleteUserQuery = 'DELETE FROM users WHERE user_id = ?';
      connection.query(deleteUserQuery, [userId], (err, result) => {
        if (err) {
          console.error('Error deleting user:', err);
          res.status(500).send({ message: 'Error occurred while deleting user.' });
        } else {
          res.status(200).send({ message: 'User deleted successfully.' });
        }
      });
    });
  });
});

// 일정 보여주는 코드

app.get('/api/getSchedule', (req, res) => {
  // 세션에서 사용자 ID 가져오기
  const userId = req.session.userId;

  // 데이터베이스에서 해당 사용자의 일정 가져오기
  const query = 'SELECT * FROM user_schedules WHERE user_id = ?';
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



app.get('/clanBossMembers/:clanName', (req, res) => {
  const clanName = req.params.clanName;

  const query = `SELECT user_nick FROM users WHERE clan = ? AND clan_boss = true`;

  connection.query(query, [clanName], (err, results) => {
    if (err) {
      console.error('Error fetching clan boss members:', err);
      res.status(500).send({ error: 'Failed to fetch clan boss members' });
    } else {
      const nicknames = results.map(result => result.nickname);
      res.status(200).send(nicknames);
    }
  });
});
// 게시판 리스트
app.get("/api/boardList", (req, res) => {
  const q = "SELECT * FROM boards";
  connection.query(q, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

// 특정 게시판 보기
app.get('/api/board/:idx', (req, res) => {
  const idx = req.params.idx;
  console.log('게시판', idx);

  const sql = `SELECT b.*, u.user_nick
    FROM boards b
    INNER JOIN users u ON b.user_id = u.user_id
    WHERE b.b_idx = ${idx}`;

  connection.query(sql, (err, data) => {
    if (err) return res.json(err);
    return res.json(data)
  })
});

// 구독 추가, 삭제
app.post('/api/subscribe', async (req, res) => {
  const { userId, teamIdx, isSubscribed } = req.body;

  if (isSubscribed) {
    // 구독 추가
    const query = 'INSERT INTO subscriptions (user_id, team_idx, created_at) VALUES (?, ?, NOW())';
    const params = [userId, teamIdx];
    connection.query(query, params, (error, result) => {
      if (error) {
        res.status(500).json({ error });
      } else {
      }
    });
  } else {
    // 구독 해제
    const query = 'DELETE FROM subscriptions WHERE user_id = ? AND team_idx = ?';
    const params = [userId, teamIdx];
    connection.query(query, params, (error, result) => {
      if (error) {
        res.status(500).json({ error });
      } else {
        res.status(200).json({ message: 'Subscription removed successfully.' });
      }
    });
  }
});

// 팀 구독 정보
app.get('/api/subscription/:team_idx/:userId', (req, res) => {
  const userId = req.params.userId;
  const team_idx = req.params.team_idx;

  const sql = `SELECT * FROM subscriptions WHERE user_id=${userId} AND team_idx=${team_idx}`;

  connection.query(sql, (err, data) => {
    if (err) return res.json(err);
    if (data.length === 0) {
      // 구독 정보가 없을 경우 isSubscribed를 false로 응답합니다.
      return res.json({ isSubscribed: false });
    } else {

      // 구독 정보가 있을 경우 isSubscribed를 true로 응답합니다.
      return res.json({ isSubscribed: true });
    }
  });
});





// 마이페이지 에서 팀 구독 전체 가져오기
app.get('/api/usersubscriptions', (req, res) => {

  console.log('app get user')
  const userId = req.session.userId;

  if (!userId) {
    res.status(401).send('Unauthorized');
    return;
  }

  const query = `
    SELECT subscriptions.user_id, teams.team_name
    FROM subscriptions
    INNER JOIN teams ON subscriptions.team_idx = teams.team_idx
    WHERE subscriptions.user_id = ?
  `;

  connection.query(query, [userId], (error, results) => {
    if (error) {
      console.error('Error fetching user subscriptions:', error);
      res.status(500).send('Error fetching user subscriptions');
    } else {
      const userSubscriptions = results;
      res.json(userSubscriptions);
    }
  });
});


// 클랜 생성 

// bodyParser를 사용하여 POST 요청의 본문을 파싱합니다.
app.use(bodyParser.json());

app.post('/api/ClanCreate', (req, res) => {
  const userId = req.session.userId;

  const clanData = req.body;
  console.log(userId);

  console.log('클랜데이터 출력:', clanData);

  const sql = `INSERT INTO clans (clan_boss_id, clan_name, clan_limit, created_at, clan_is, clan_logo)
  VALUES ('${userId}', '${clanData.clanName}', ${clanData.clanMembers}, NOW(), 'Y', '${clanData.clanImage}')`;

  res.send('클랜 생성 데이터 전송성공');
  // SQL 쿼리 실행
  connection.query(sql, (err, results) => {
    if (err) {
      console.error('클랜 생성 에러:', err);
      return;
    }
    console.log('클랜 생성 성공');
    // 쿼리 결과 출력
    console.log('Insert ID:', results.insertId);
  });

});

// 클랜 삭제 기능
app.delete('/api/ClanDelete/', (req, res) => {
  // const userId = req.session.userId;

  // 클랜 삭제를 위한 SQL 문
  const sql = `DELETE FROM clans WHERE clan_boss_id = ?`;

  connection.query(sql, ['user2@example.com'], (err, results) => {
    if (err) {
      console.error('클랜 삭제 에러:', err);
      res.status(500).send('클랜 삭제 중 오류가 발생했습니다.');
      return;
    }
    console.log('클랜 삭제 성공');
    res.status(200).send('클랜 삭제가 완료되었습니다.');
  });
});


// 경기 일정 가져오기
app.get('/api/schedule/:userId', (req, res) => {
  const userId = req.params.userId;
  console.log(userId);

  // 개인 일정 가져오기
  const personalQuery = 'SELECT * FROM user_schedules WHERE user_Id = ?';
  connection.query(personalQuery, [userId], (err, personalScheduleData) => {
    if (err) return res.json(err);



    // 클랜 일정 가져오기
    const clanQuery = `
    SELECT cs.* 
    FROM clan_schedules cs
    JOIN users u ON cs.user_id = u.user_id
    WHERE u.clan = (
      SELECT clan 
      FROM users 
      WHERE user_id = ?
      )
    `;
    connection.query(clanQuery, [userId], (err, clanScheduleData) => {
      if (err) return res.json(err);

      // 구독한 팀의 경기일정 가져오기
      const subscribedMatchQuery = `
      SELECT ms.*
      FROM matches ms
      JOIN subscriptions s ON ms.team_1 = s.team_idx OR ms.team_2 = s.team_idx 
      WHERE s.user_id =  ?
      `;
      connection.query(subscribedMatchQuery, [userId], (err, subscribedMatchScheduleData) => {
        if (err) return res.json(err);

        // 모든 일정 데이터를 JSON 형태로 응답
        res.json({
          personal: personalScheduleData,
          clan: clanScheduleData,
          subscribedMatch: subscribedMatchScheduleData
        });
      });
    });
  });
});


// 서버 실행
app.listen(port, () => {
  console.log('server is running at 5000');
  //scheduleMatches(); 문자서비스 코드_살리지 말것.
});

