const express = require('express');
const app = express();
app.use(express.json());
let tasks=[];
app.get('/', (req, res)=>{
    res.send('Hello');
});

app.post('/tasks', (req, res)=>{
    const {title, date}= req.body;
    if (!title || !date){
        return res.status(400).send('please enter title and date');
    }
    const newTask={
        id: tasks.length+1,
        title: req.body.title,
        date: req.body.date,
        done: false
    };
    tasks.push(newTask);
    res.send(newTask);
})
app.get('/tasks', (req, res)=>{
    res.send(tasks);
})

app.put('/tasks/:id', (req, res)=>{
    const id= Number(req.params.id);
    const task= tasks.find(t => t.id === id);
    if(!task){
        return res.status(404).send('Task Not Found');
    }
    task.done=true;
    res.send(task);
})
app.delete('/tasks/:id', (req, res)=>{
    const id= Number(req.params.id);
    const task= tasks.find(t => t.id === id);
    if(!task){
        return res.status(404).send('Task Not Found');
    }
    tasks=tasks.filter(t => t.id !== id);
    res.send({message:'Task deleted successfully'});
})
app.listen(3000, ()=>{
    console.log('Express server started');
});
