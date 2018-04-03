#! /usr/bin/env node
/* eslint-disable no-console */

const chalk = require('chalk');
const ejs = require('ejs');
const figlet = require('figlet');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const ora = require('ora');
const path = require('path');
const read = require('recursive-readdir');
const shell = require('shelljs');

const JS_WHITELIST = ['.eslintrc.json', '.jestrc.json'];

const CSS_WHITELIST = ['.stylelintrc'];

/**
 * Collects user input for app configuration
 *
 * @returns {Promise<Object>} - resolves to a config obejct
 */
function collectInput() {
	return inquirer.prompt([
		{
			default: 'my-package',
			message: "What's the package name?",
			name: 'name',
			type: 'input'
		},
		{
			default: '',
			message: "What's the package description?",
			name: 'description',
			type: 'input'
		},
		{
			default: [],
			message: 'What technologies does the package use?',
			name: 'tech',
			type: 'checkbox',
			choices: ['css', 'js']
		}
	]);
}

/**
 * Utility function to sanitize config input
 *
 * @param {object} config - user input configuration object
 * @returns {object} - user input configuration object
 */
function sanitizeInput(config) {
	config.tech = {
		css: config.tech.includes('css'),
		js: config.tech.includes('js')
	};
	return config;
}

/**
 * Utility function to sanitize EJS file endings
 *
 * @param {string} filePath - path to a file
 * @returns {string} - path to a file with no .ejs extension
 */
function sanitizePath(filePath) {
	if (path.extname(filePath) === '.ejs') {
		filePath = filePath.replace(/\.ejs$/, '');
	}
	return filePath;
}

/**
 * Utility function to determine if a file should be rendered
 *
 * @param {object} config - user input configuration object
 * @param {string} filePath - path to a file
 * @returns {boolean} - if the specified file should be rendered
 */
function shouldRenderFile(config, filePath) {
	if (!config.tech.js && JS_WHITELIST.includes(path.basename(filePath))) {
		return false;
	}
	if (!config.tech.css && CSS_WHITELIST.includes(path.basename(filePath))) {
		return false;
	}
	return true;
}

/**
 * Generates a project structure
 *
 * @param {string} name - slugified package name
 * @returns {Promise} - resolves when structure is generated
 */
async function generateStructure(config) {
	const filePaths = await read(path.join(__dirname, './template'));

	for (const absolutePath of filePaths) {
		if (shouldRenderFile(config, absolutePath)) {
			const relativePath = path.relative('./template', path.relative(__dirname, absolutePath));
			const newPath = sanitizePath(path.join(config.name, relativePath));
			const data = await new Promise(resolve => {
				ejs.renderFile(absolutePath, config, (e, file) => resolve(file));
			});

			await fs.outputFile(newPath, data);
		}
	}
}

/**
 * Executes a command at a given path
 *
 * @param {string} cmd - shell command to execute
 * @param {string} cwd - working directory to change to
 * @param {boolean} silent - do not send command output to stdout
 * @returns {Promise} - resolves when the command completes
 */
function execute(cmd, cwd, silent = true) {
	return new Promise(resolve => {
		shell.exec(cmd, { cwd, silent }, resolve);
	});
}

(async function() {
	// Intro logging
	console.log(`\n${figlet.textSync('CASTER')}\n`);

	try {
		// Collect user configuration
		const config = sanitizeInput(await collectInput());
		console.log('');

		// Generate project structure
		const generation = generateStructure(config);
		ora.promise(generation, { text: 'Generating project structure' });
		await generation;

		// Install project dependencies
		const installation = execute('npm install', config.name);
		ora.promise(installation, { text: 'Installing project dependencies' });
		await installation;

		// Success outro logging
		console.log(
			`\n  ${chalk.bold(chalk.green('Success!'))} Generated ${config.name} at ${path.resolve(config.name)}.`
		);
		console.log('  The following commands are available within that directory:\n');
		config.tech.js && console.log(`  ${chalk.cyan('npm run test')}            Runs JavaScript unit tests`);
		config.tech.js && console.log(`  ${chalk.cyan('npm run eslint')}          Lints JavaScript files`);
		config.tech.css && console.log(`  ${chalk.cyan('npm run stylelint')}       Lints CSS files`);
		console.log(`  ${chalk.cyan('npm run prettier')}        Format files`);
		console.log(chalk.bold('\n  Lock and load.\n\n'));
	} catch (error) {
		// Error outro logging
		console.log(`\n  ${chalk.bold(chalk.red('Failure.'))} Something went horribly, horribly wrong.\n\n`);
	}
})();
