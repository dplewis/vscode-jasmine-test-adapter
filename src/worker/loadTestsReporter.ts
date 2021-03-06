import { TestSuiteInfo, TestInfo } from "vscode-test-adapter-api";
import { Location } from "./patchJasmine";

export class LoadTestsReporter implements jasmine.CustomReporter {

	private readonly rootSuite: TestSuiteInfo;
	private readonly suiteStack: TestSuiteInfo[];
	private currentFile: string | undefined;

	private get currentSuite(): TestSuiteInfo {
		return this.suiteStack[this.suiteStack.length - 1];
	}

	constructor(
		private readonly done: (result: TestSuiteInfo) => void,
		private readonly locations: Map<string, Location>
	) {
		this.rootSuite = {
			type: 'suite',
			id: 'root',
			label: '',
			children: [],
		};

		this.suiteStack = [ this.rootSuite ];

		// we use process on exit as jasmineDone may not be called
		process.on('exit', () => {
			this.emitLastSuite();
		});
	}

	makeFileSuite(file: string): TestSuiteInfo {
		return {
			type: 'suite',
			id: file,
			file: file,
			label: file,
			children: [],
			isFileSuite: true,
		} as TestSuiteInfo
	}

	suiteStarted(result: jasmine.CustomReporterResult): void {

		const suite: TestSuiteInfo = {
			type: 'suite',
			id: result.fullName,
			label: result.description,
			children: []
		};

		const location = this.locations.get(result.id);
		if (location) {
			this.processCurrentLocation(location);
			suite.file = location.file;
			suite.line = location.line;
		}

		this.currentSuite.children.push(suite);
		this.suiteStack.push(suite);
	}

	suiteDone() {
		this.suiteStack.pop();
	}

	specStarted(result: jasmine.CustomReporterResult): void {
		const test: TestInfo = {
			type: 'test',
			id: result.fullName,
			label: result.description
		}

		const location = this.locations.get(result.id);
		if (location) {
			this.processCurrentLocation(location);
			test.line = location.line,
			test.file = location.file
		} else {
			console.log('Could not find location for spec', result.fullName);
		}

		this.currentSuite.children.push(test);
	}

	// This method will add a file suite if we changed
	// The current file we're currenlty processing and push it
	// On to the stack
	// It will also emit through this.done() the last file
	// This way we emit one suite per file, which keeps things manageable
	// and mall enought for IPC
	private processCurrentLocation(location: Location) {
		if (location.file != this.currentFile) {
			const fileSuite = this.makeFileSuite(location.file);
			this.emitLastSuite();
			this.currentFile = location.file;
			this.suiteStack.push(fileSuite);
		}
	}

	private emitLastSuite() {
		if (!this.currentFile) { return; }
		const doneSuite = this.suiteStack.pop();
		if (doneSuite) {
			this.done(doneSuite);
		}
	}
}
