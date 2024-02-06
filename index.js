const fs = require('fs');
const path = require('path');

async function findTextFiles(dir, fileList = []) {
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.promises.stat(filePath);
        if (stat.isDirectory()) {
            await findTextFiles(filePath, fileList);
        } else if (file.endsWith('.txt')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

async function analyzeDependencies(files) {
    const dependencies = {};
    for (const file of files) {
        const content = await fs.promises.readFile(file, 'utf-8');
        const requires = content.match(/require ‘(.+)’/g) || [];
        dependencies[file] = requires.map(dep => {
            const match = dep.match(/require\s+‘([^’]+)’/);
            if (match && match[1]) {
                return path.resolve(__dirname, match[1] + '.txt');
            } else {
                return null;
            }
        }).filter(Boolean); 
    }
    return dependencies;
}

function buildDependencyGraph(dependencies) {
    const graph = new Map();
    for (const [file, deps] of Object.entries(dependencies)) {
        if (!graph.has(file)) {
            graph.set(file, new Set());
        }
        for (const dep of deps) {
            graph.get(file).add(dep);
        }
    }
    return graph;
}

function topologicalSort(graph) {
    const sorted = [];
    const visited = new Set();
    const temp = new Set();
    let hasCycle = false;

    function visit(node) {
        if (temp.has(node)) {
            console.error(`Обнаружен цикл зависимостей, включающий ${node}`);
            hasCycle = true;
            return;
        }
        if (!visited.has(node)) {
            temp.add(node);
            graph.get(node).forEach(visit);
            temp.delete(node);
            visited.add(node);
            sorted.push(node);
        }
    }

    graph.forEach((_, node) => visit(node));

    if (hasCycle) {
        console.error('Обнаружена циклическая зависимость.');
        return null;
    }
    console.log(sorted)
    return sorted;
}

async function concatenateFiles(files, outputFile) {
    const outputStream = fs.createWriteStream(outputFile);
    for (const file of files) {
        const content = await fs.promises.readFile(file, 'utf-8');
        outputStream.write(content + '\n\n');
    }
    outputStream.end();
}

async function main(rootDir, outputFile) {
    try {
        const files = await findTextFiles(rootDir);
        const dependencies = await analyzeDependencies(files);
        const graph = buildDependencyGraph(dependencies);
        const sortedFiles = topologicalSort(graph);
        if (sortedFiles) {
            await concatenateFiles(sortedFiles, outputFile);
            console.log('Файлы успешно сконкатенированы и сохранены в', outputFile);
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

const rootDir = process.cwd();
const outputFile = 'result.txt';
main(rootDir, outputFile);