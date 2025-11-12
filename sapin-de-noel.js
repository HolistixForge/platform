

// ici j'ecris ce que je veux l'ordinateur ne regarde pas ca


function printTree(height, caracter) {

    let line = caracter;

   

    for(let i = 0; i < height; i++) {
        
        let blank = '';

        for (let j = 0; j < height - i; j++) {
            blank = blank + ' ';
        }

        console.log(blank, line);

        line = line + caracter + caracter;
    }

    const tronc = height / 5;

    let blank = '';
    for (let i = 0; i < height - tronc / 2; i++) {
        blank = blank + ' ';
    }

    line = '';
    for (let i = 0; i < tronc; i++) {
        line = line + caracter;
    }

    for (let i = 0; i < tronc; i++) {
        console.log(blank, line);
    }
}


printTree(31, 'A');

/*

   #
  ###
 #####
   #


*/