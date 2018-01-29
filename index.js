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

/**
 * Collects user input for app configuration
 *
 * @returns {Promise<Object>} - resolves to a config obejct
 */
function collectInput() {
	return inquirer.prompt([
		{
			default: 'my-package',
			message: 'What\'s the package name?',
			name: 'name',
			type: 'input'
		},
		{
			default: '',
			message: 'What\'s the package description?',
			name: 'description',
			type: 'input'
		},
		{
			default: false,
			message: 'Does the package use CSS?',
			name: 'css',
			type: 'confirm'
		}
	]);
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
		const relativePath = path.relative('./template', path.relative(__dirname, absolutePath));
		const newPath = path.join(config.name, relativePath);
		const data = await new Promise(resolve => {
			ejs.renderFile(absolutePath, config, (e, file) => resolve(file));
		});

		await fs.outputFile(newPath, data);
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
	console.log(`\n${figlet.textSync("CASTER")}\n`);

	try {
		// Collect user configuration
		const config = await collectInput();
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
		console.log(`  ${chalk.cyan('npm run eslint')}       Lints JavaScript files`);
		console.log(`  ${chalk.cyan('npm run test')}         Runs JavaScript unit tests`);
		config.css && console.log(`  ${chalk.cyan('npm run stylelint')}    Lints CSS files`);
		console.log(chalk.bold('\n  Lock and load.\n\n'));
	} catch (error) {
		// Error outro logging
		console.log(`\n  ${chalk.bold(chalk.red('Failure.'))} Something went horribly, horribly wrong.`);
	}
})();
