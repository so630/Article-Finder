const express = require('express');
const app = express();
const mongoose = require('mongoose');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const session = require('express-session');
const findOrCreate = require('mongoose-findorcreate')
const bodyParser = require('body-parser');
const monkeylearn = require('monkeylearn');
const Article = require('newspaperjs').Article;
const lodash = require('lodash');
const cookieParser = require('cookie-parser');
const googleNews = require('google-news-json');

mongoose.connect('mongodb+srv://admin-soham:soham@cluster0.rgrzw.mongodb.net/ArticleUsersDB', {useNewUrlParser: true, useUnifiedTopology: true})


const userSchema = mongoose.Schema({
    username: String,
    password: String,
})

const keywordSchema = mongoose.Schema({
    username: String,
    keywords: Array,
    title: String
})

const articlePhraseSchema = mongoose.Schema({
    username: String,
    articles: Array,
    title: String
})

const articleTopicSchema = mongoose.Schema({
    username: String,
    articles: Array,
    title: String
})

let name;

app.use(cookieParser())
app.use(express.static(__dirname + '/public'))
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'ejs')

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

app.use(session({
    secret: 'Our little secret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

const User = mongoose.model('User', userSchema);
const Keyword = mongoose.model('Keyword', keywordSchema);
const Article1 = mongoose.model('ArticlePhrase', articlePhraseSchema)
const Article2 = mongoose.model('ArticleTopic', articleTopicSchema)


passport.use(User.createStrategy())

passport.serializeUser(function(user, done) {
    done(null, {
       username: user["username"]
    });
 });
passport.deserializeUser(function(obj, done) {
    done(null, obj)
});


app.get('/', function(req, res) {
    res.render('home');
})

app.get('/signin', function(req, res) {
    res.render('signin');
})

app.get('/register', function(req, res) {
    res.render('register');
})

app.get('/dashboard', function(req, res) {
    if (req.isAuthenticated()) {
        res.render('dashboard', {name: name});
    } else {
        res.redirect('/signin')
    }
})

app.get('/extract', function(req, res) {
    if (!req.isAuthenticated()) {
        res.render('extract')
    } else {
        res.render('extract-username-included')
    }
})

app.get('/history-keyword', function(req, res) {
    if (req.isAuthenticated()) {
        let keywords;
        Keyword.find({username: req.cookies['username']}, function(err, result){
            if (err) {
                console.log(err)
            } else {
                keywords = result;
                res.render('history-keywords', {keywordArrays: keywords})
            }
            
        })

        
    } else {
        res.redirect('/')
    }
})

app.get('/history-article-phrases', function(req, res) {
    if (req.isAuthenticated()) {
        Article1.find({username: req.cookies['username']}, function(err, result) {
            if (err) {
                console.log(err);
                res.redirect('/');
            } else {
                res.render('history-articles', {articles: result});
            }
            
        })
    } else {
        res.redirect('/');
    }
})

app.get('/history-article-phrase/:__id', function(req, res) {
    

    if (req.isAuthenticated()) {
        Article1.findById(req.params.__id, function(err, result) {
            if (err) {
                console.log(err);
            } else {
                res.render('articles', {articles: result.articles[0]})
            }
        })
    } else {
        res.redirect('/');
    }

})


// signin
app.post('/signin', function(req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    })

    req.login(user, (err) => {
        if (err) {
            console.log(err)
            res.redirect('/')
        } else {
            passport.authenticate('local')(req, res, () => {
                res.cookie('username', user.username);
                let index = req.body.username.indexOf('@');
                name = req.body.username.substring(0, index)
                
                res.redirect('/dashboard')
            })
        }
    })
})

// register
app.post('/register', function(req, res) {
    User.register({username: req.body.username, active: false}, req.body.password, (err, user) => {
        if (err) {
            console.log(err)
            res.redirect('/')
        } else {
            passport.authenticate('local')(req, res, () => {
                res.cookie('username', user.username);
                let index = req.body.username.indexOf('@');
                name = lodash.capitalize(req.body.username.substring(0, index));
                
                res.redirect('/dashboard')
            })
            
        }
    })
})

// logout
app.post('/logout', function(req, res) {
    req.logout()
    res.redirect('/');
})

//time for the real part, code that works with the article is below here

app.post('/extract-text', function(req, res) {
    const text = req.body.text;
    let data = [text]
    const ml = new monkeylearn('c7746e6211afdc2215fbc146e82b5b29878f9605')
    let model_id = 'ex_YCya9nrn'
    ml.extractors.extract(model_id, data).then(response => {
        let resp = response.body[0].extractions;
        res.render('extract-result', {keywords: resp})
    })
})

app.post('/extract-url', function(req, res) {
    
    Article(String(req.body.url)).then(function(result) {
        let data = [result.text];
        const ml = new monkeylearn('c7746e6211afdc2215fbc146e82b5b29878f9605')
        let model_id = 'ex_YCya9nrn'
        ml.extractors.extract(model_id, data).then(response => {
            let resp = response.body[0].extractions;
            res.render('extract-result', {keywords: resp})
        })
    })
})

app.post('/extract-text-username', function(req, res) {
    const text = req.body.text;
    let data = [text]
    const ml = new monkeylearn('c7746e6211afdc2215fbc146e82b5b29878f9605')
    let model_id = 'ex_YCya9nrn'
    let resp;
    ml.extractors.extract(model_id, data).then(response => {
        resp = response.body[0].extractions;
        console.log(req.cookies['username'])
        const keyword = new Keyword({
            username: req.cookies['username'],
            keywords: resp,
            title: resp[0]
        })
    
        keyword.save()
        res.render('extract-result', {keywords: resp})

        
    })

    
    
})

app.post('/extract-url-username', function(req, res) {
    
    Article(String(req.body.url)).then(function(result) {
        let data = [result.text];
        const ml = new monkeylearn('c7746e6211afdc2215fbc146e82b5b29878f9605')
        let model_id = 'ex_YCya9nrn'
        let resp;
        ml.extractors.extract(model_id, data).then(response => {
            resp = response.body[0].extractions;
            console.log(req.cookies['username'])
            const keyword = new Keyword({
                username: req.cookies['username'],
                keywords: resp,
                title: lodash.lowerCase(result.title)
            })
    
            keyword.save()
            res.render('extract-result', {keywords: resp})

            
        })

        
    })
    
    
    

})

app.get('/find-with-phrase', function(req, res) {
    res.render('find-with-phrase');
})

app.post('/find-with-phrase', function(req, res) {
    if (req.isAuthenticated()) {
        googleNews.getNews(googleNews.SEARCH, req.body.phrase, 'en-GB', (err, news) => {
            const article = new Article1({
                username: req.cookies['username'],
                articles: news,
                title: req.body.phrase
            })
            article.save();
            console.log(news);
            res.render('articles', {articles: news})
        })

        
    } else {
        googleNews.getNews(googleNews.SEARCH, req.body.phrase, 'en-GB', (err, news) => {
            console.log(news)
            res.render('articles', {articles: news})
        })
    }
})

app.get('/find-with-topic', function(req, res) {
    res.render('find-with-similar');
})

app.post('/find-with-topic', function(req, res) {
    if (req.isAuthenticated()) {
        Article(String(req.body.phrase)).then(function(result) {
            googleNews.getNews(googleNews.SEARCH, result.title, 'en-GB', (err, news) => {
                const article = new Article2({
                    username: req.cookies['username'],
                    articles: news,
                    title: result.title
                })
                article.save();
                console.log(news);
                res.render('articles', {articles: news})
            })
        })
    } else {
        Article(String(req.body.phrase)).then(function(result) {
            googleNews.getNews(googleNews.SEARCH, result.title, 'en-GB', (err, news) => {
                console.log(news);
                res.render('articles', {articles: news})
            })
        })
    }
})

app.get('/history-article-topic', function(req, res) {
    if (req.isAuthenticated()) {
        Article2.find({username: req.cookies['username']}, function(err, result) {
            if (err) {
                console.log(err);
                res.redirect('/');
            } else {
                res.render('history-articles-topic', {articles: result});
            }
            
        })
    } else {
        res.redirect('/');
    }
})

app.get('/history-article-topic/:__id', function(req, res) {
    

    if (req.isAuthenticated()) {
        Article2.findById(req.params.__id, function(err, result) {
            if (err) {
                console.log(err);
            } else {
                res.render('articles', {articles: result.articles[0]})
            }
        })
    } else {
        res.redirect('/');
    }

})





app.listen(process.env.PORT || 3000, function() {
    console.log('listening on port ' + process.env.PORT || 3000);
})