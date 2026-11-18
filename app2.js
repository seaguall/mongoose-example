/**
 * 데이터베이스 사용하기
 * 
 * mongoose로 데이터베이스 다루기
 * 사용자 조회, 사용자 추가, 사용자 리스트 조회
 *
 * 웹브라우저에서 아래 주소의 페이지를 열고 웹페이지에서 요청
 *    http://localhost:3000/public/login.html
 *    http://localhost:3000/public/adduser2.html
 *
 * @date 2026-11-10
 * @author Mike
 */

// 익스프레스 기본 모듈 불러오기
var express = require('express'), http = require('http'), path = require('path');

// Express 미들웨어 불러오기
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var static = require('serve-static');
var errorHandler = require('errorhandler');

// 에러 핸들러 모듈 사용
var expressErrorHandler = require('express-error-handler');

// Session 미들웨어 불러오기
var expressSession = require('express-session');

// mongoose 모듈 불러오기
var mongoose = require('mongoose');

// 익스프레스 객체 생성
var app = express();

// body-parser를 이용해 application/json 파싱
app.use(bodyParser.json());
// body-parser를 이용해 application/x-www-form-urlencoded 파싱
app.use(bodyParser.urlencoded({ extended: false }));

// public 폴더를 static으로 오픈
app.use('/public', static(path.join(__dirname, 'public')));

// cookie-parser 설정
app.use(cookieParser());

app.use(expressSession({
  secret: 'my_key',
  resave: true,
  saveUninitialized: true
}));

//=== 데이터베이스 연결 ===//
// 데이터베이스 객체를 위한 변수 선언
var database;

// 데이터베이스 스키마 객체를 위한 변수 선언
var UserSchema;

// 데이터베이스 모델 객체를 위한 변수 선언
var UserModel;

// 데이터베이스에 연결
function connectDB() {
  // 데이터베이스 연결 정보
  var databaseUrl = 'mongodb://localhost:27017/local';

  // 데이터베이스 연결
  console.log('데이터베이스 연결을 시도합니다.');
  mongoose.Promise = global.Promise;
  
  mongoose.connect(databaseUrl)
    .then(() => {
      database = mongoose.connection;
      console.log('데이터베이스에 연결되었습니다. : ' + databaseUrl);

      // 스키마 정의
      UserSchema = mongoose.Schema({
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        name : { type: String, index: 'hashed'},
        age: { type: Number, 'default': -1},
        created_at: { type: Date, index: {unique: false}, 'default': Date.now},
        updated_at: { type: Date, index: {unique: false}, 'default': Date.now}
      });
      console.log('UserSchema 정의함.');

      // 스키마에 static으로 findByEmail 메소드 추가
      UserSchema.static('findByEmail', function(email) {
        return this.find({ email: email }).exec();
      });

      // 스키마에 static으로 findAll 메소드 추가
      UserSchema.static('findAll', function() {
        return this.find({}).exec();
      });

      // UserModel 모델 정의 (이미 정의된 경우 방지)
      try {
        UserModel = mongoose.model('users2');
      } catch (err) {
        UserModel = mongoose.model('users2', UserSchema);
      }
      console.log('UserModel 정의함');
    })
    .catch(err => {
      console.error('mongoose connection error.', err);
    });

  // 연결 끊어졌을 때 5초 후 재연결
  if (mongoose.connection) {
    mongoose.connection.on('disconnected', function() {
      console.log('연결이 끊어졌습니다. 5초 후 재연결합니다.');
      setTimeout(connectDB, 5000);
    });
  }
}

//=== 라우팅 함수 등록 ===//
// 라우터 객체 참조
var router = express.Router();

// 로그인 라우팅 함수 - 데이터베이스의 정보와 비교
router.route('/process/login').post(async function(req, res) {
  console.log('/process/login 호출됨.');

  // 요청 파라미터 확인
  var paramEmail = req.body.email || req.query.email;
  var paramPassword = req.body.password || req.query.password;

  console.log('요청 파라미터 : ' + paramEmail + ', ' + paramPassword);

  // 데이터베이스 객체가 초기화된 경우, authUser 함수 호출하여 사용자 인증
  if (database) {    
    try {
      var docs = await authUser(database, paramEmail, paramPassword);

      // 조회된 레코드가 있으면 성공 응답 전송
      if (docs) {
        console.dir(docs);

        // 조회 결과에서 사용자 이름 확인
        var username = docs[0].name;
        
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf8' });
        res.write('<h1>로그인 성공</h1>');
        res.write('<div><p>사용자 아이디 : ' + paramEmail + '</p></div>');
        res.write('<div><p>사용자 이름 : ' + username + '</p></div>');
        res.write("<br><br><a href='/public/login.html'>다시 로그인하기</a>");
        res.end();
      } else {
        // 조회된 레코드가 없는 경우 실패 응답 전송
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf8' });
        res.write('<h1>로그인 실패</h1>');
        res.write('<div><p>사용자 아이디 또는 비밀번호가 일치하지 않습니다.</p></div>');
        res.write("<br><br><a href='/public/login.html'>다시 로그인하기</a>");
        res.end();
      }
    } catch (err) {
      throw err;
    }
  } else {
    // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf8' });
    res.write('<h1>데이터베이스 연결 실패</h1>');
    res.write('<div><p>데이터베이스 연결이 되지 않았습니다.</p></div>');
    res.end();
  }
});

// 사용자 추가 라우팅 함수 - 클라이언트에서 보내오는 데이터를 이용해 데이터베이스에 추가
router.route('/process/adduser').post(async function(req, res) {
  console.log('/process/adduser 호출됨.');

  var paramEmail = req.body.email || req.query.email;
  var paramPassword = req.body.password || req.query.password;
  var paramName = req.body.name || req.query.name;
  var paramAge = req.body.age || req.query.age;
	
  console.log('요청 파라미터 : ' + paramEmail + ', ' + paramPassword + ', ' + paramName + ', ' + paramAge);
    
  // 데이터베이스 객체가 초기화된 경우, addUser 함수 호출하여 사용자 추가
  if (database) {
    try {
      var addedUser = await addUser(database, paramEmail, paramPassword, paramName, paramAge);
      
      // 결과 객체 있으면 성공 응답 전송
      if (addedUser) {
        console.dir(addedUser);

        res.writeHead(200, {'Content-Type':'text/html;charset=utf8'});
        res.write('<h2>사용자 추가 성공</h2>');
        res.write("<br><br><a href='/public/login.html'>다시 로그인하기</a>");
        res.end();
      } else {  // 결과 객체가 없으면 실패 응답 전송
        res.writeHead(200, {'Content-Type':'text/html;charset=utf8'});
        res.write('<h2>사용자 추가 실패</h2>');
        res.end();
      }
    } catch (err) {
      throw err;
    }
  } else {  // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
    res.writeHead(200, {'Content-Type':'text/html;charset=utf8'});
    res.write('<h2>데이터베이스 연결 실패</h2>');
    res.end();
  }
});

// 사용자 리스트 라우팅 함수
router.route('/process/listuser').post(async function(req, res) {
  console.log('/process/listuser 호출됨.');

  // 데이터베이스 객체가 초기화된 경우, 모델 객체의 findAll 메소드 호출
  if (database) {
    try {
      var results = await UserModel.findAll();

      // 결과 객체 있으면 리스트 전송
      if (results) {
        console.dir(results);

        res.writeHead(200, {'Content-Type':'text/html;charset=utf8'});
        res.write('<h2>사용자 리스트</h2>');
        res.write('<div><ul>');
        
        for (var i = 0; i < results.length; i++) {
          var curEmail = results[i]._doc.email;
          var curName = results[i]._doc.name;
          var curAge = results[i]._doc.age;
          res.write('    <li>#' + i + ' : ' + curEmail + ', ' + curName + ', ' + curAge + '</li>');
        }	
      
        res.write('</ul></div>');
        res.end();
      } else {  
        res.writeHead(200, {'Content-Type':'text/html;charset=utf8'});
        res.write('<h2>사용자 리스트 조회 실패</h2>');
        res.end();
      }
    } catch (err) {
      console.error('사용자 리스트 조회 중 에러 발생 : ' + err.stack);
      res.writeHead(200, {'Content-Type':'text/html;charset=utf8'});
      res.write('<h2>사용자 리스트 조회 중 에러 발생</h2>');
      res.write('<p>' + err.stack + '</p>');
      res.end();
    }
  } else {
    res.writeHead(200, {'Content-Type':'text/html;charset=utf8'});
    res.write('<h2>데이터베이스 연결 실패</h2>');
    res.end();
  }
});

// 라우터 객체 등록
app.use('/', router);

// 사용자를 인증하는 함수 (Promise 비동기 처리)
var authUser = async function(database, email, password) {
	console.log('authUser 호출됨 : ' + email + ', ' + password);
	
  // 이메일을 이용해 검색
	var results = await UserModel.findByEmail(email);
	console.log('이메일 [%s]로 사용자 검색결과', email);
	console.dir(results);
	
	if (results.length > 0) {
		console.log('이메일과 일치하는 사용자 찾음.');
		
		// 패스워드 확인
		if (results[0]._doc.password === password) {
			console.log('비밀번호 일치함');
			return results;
		} else {
			console.log('비밀번호 일치하지 않음');
			return null;
		}
	} else {
    console.log("이메일과 일치하는 사용자를 찾지 못함.");
    return null;
  }
};

// 사용자를 추가하는 함수 (Promise 비동기 처리)
var addUser = async function(database, email, password, name, age) {
	console.log('addUser 호출됨 : ' + email + ', ' + password + ', ' + name + ', ' + age);
	
	// UserModel 인스턴스 생성
	var user = new UserModel({ "email": email, "password": password, "name": name, "age": age });

	// save()로 저장
	var addedUser = await user.save();
	console.log("사용자 데이터 추가함.");
	return addedUser;
};

// 404 에러 페이지 처리
var errorHandlerInstance = expressErrorHandler({
  static: {
    '404': './public/404.html'
  }
});
app.use(expressErrorHandler.httpError(404));
app.use(errorHandlerInstance);

//=== 서버 시작 ===//

// 프로세스 종료 시에 데이터베이스 연결 해제
process.on('SIGTERM', function() {
  console.log("프로세스가 종료됩니다.");
  app.close();
});

app.on('close', function() {
  console.log("Express 서버 객체가 종료됩니다.");
  if (database) {
    database.close();
  }
});

// 기본 속성 설정
app.set('port', process.env.PORT || 3000);

// 서버 시작
http.createServer(app).listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));

  // 데이터베이스 연결
  connectDB();
});